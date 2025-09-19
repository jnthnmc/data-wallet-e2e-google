
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function App() {
  const [connected, setConnected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState('Google');
  const [accounts, setAccounts] = useState([
    { name: 'Google', data: ['Search history', 'Location history', 'Ad interests'], connected: false },
    { name: 'Facebook', data: ['Liked pages', 'Ad preferences', 'Friends list'], connected: false },
    { name: 'Amazon', data: ['Purchase history', 'Wishlist', 'Payment methods'], connected: false },
  ]);

  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true, scheme: 'datawallet' });
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const scopes = ['openid','email','profile'];

  const startGoogleLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      const req = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        scopes,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      });

      await req.makeAuthUrlAsync(discovery);
      const res = await req.promptAsync(discovery, { useProxy: true });

      if (res.type !== 'success' || !res.params.code) {
        setBusy(false);
        setError('Login was cancelled or failed.');
        return;
      }

      const tokenRes = await AuthSession.exchangeCodeAsync(
        {
          code: res.params.code,
          clientId,
          redirectUri,
          extraParams: { code_verifier: req.codeVerifier || '' },
        },
        discovery
      );

      if (tokenRes.refreshToken) {
        await SecureStore.setItemAsync('google_refresh_token', tokenRes.refreshToken);
      }

      const userinfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
      }).then(r => r.json());

      setProfile(userinfo);

      const idx = accounts.findIndex(a => a.name === 'Google');
      const next = [...accounts];
      next[idx].connected = true;
      setAccounts(next);
      setConnected(true);
      setBusy(false);
    } catch (e) {
      setBusy(false);
      setError(String(e));
    }
  };

  const revokeGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const rt = await SecureStore.getItemAsync('google_refresh_token');
      if (rt) {
        await fetch(discovery.revocationEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `token=${encodeURIComponent(rt)}`,
        });
        await SecureStore.deleteItemAsync('google_refresh_token');
      }
      setProfile(null);
      const idx = accounts.findIndex(a => a.name === 'Google');
      const next = [...accounts];
      next[idx].connected = false;
      setAccounts(next);
      setConnected(next.some(a => a.connected));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{paddingBottom: 28}}>
        <View style={styles.card}>
          <Text style={styles.h1}>Take control of your data</Text>
          <Text style={styles.sub}>Connect a service to see what data it holds and take action.</Text>
          <View style={styles.row}>
            <Button title="Connect Google" onPress={()=>{ setActiveProvider('Google'); setModalOpen(true); }} />
            <Button title="Connect Facebook" onPress={()=>{ setActiveProvider('Facebook'); setModalOpen(true); }} outline />
            <Button title="Connect Amazon" onPress={()=>{ setActiveProvider('Amazon'); setModalOpen(true); }} outline />
          </View>
        </View>

        {accounts.map((acc, idx) => (
          <View key={acc.name} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.h2}>{acc.name}</Text>
              {!acc.connected ? (
                <Button title="Connect" onPress={()=>{ setActiveProvider(acc.name); setModalOpen(true); }} />
              ) : (
                <Chip label="Connected" />
              )}
            </View>

            {!acc.connected ? (
              <Text style={styles.subSmall}>See and control: {acc.data.join(', ')}</Text>
            ) : (
              <View>
                <Text style={styles.subSmall}>Data they store:</Text>
                {acc.data.map((d) => <Text key={d} style={styles.small}>• {d}</Text>)}
              </View>
            )}
          </View>
        ))}

        {profile && (
          <View style={styles.card}>
            <Text style={styles.h2}>Google Profile</Text>
            <View style={{flexDirection:'row', alignItems:'center', gap:12, marginTop:8}}>
              {profile.picture ? <Image source={{ uri: profile.picture }} style={{width:48, height:48, borderRadius:24}} /> : null}
              <View>
                <Text style={{fontWeight:'700'}}>{profile.name}</Text>
                <Text style={{color:'#555'}}>{profile.email}</Text>
              </View>
            </View>
          </View>
        )}

        {connected && (
          <View style={styles.card}>
            <Text style={styles.h2}>Security Status</Text>
            <Text style={styles.subSmall}>Your data is stored locally in an encrypted vault (demo). You can revoke access anytime.</Text>
          </View>
        )}

        {error && (
          <View style={[styles.card, {borderColor: '#FECACA', borderWidth: 1}]}>
            <Text style={{color:'#991B1B', fontWeight:'700'}}>Error</Text>
            <Text style={{color:'#7F1D1D'}}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <ConnectModal
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        provider={activeProvider}
        onConnectGoogle={startGoogleLogin}
        onRevokeGoogle={revokeGoogle}
        busy={busy}
      />
    </View>
  );
}

function ConnectModal({ open, onClose, provider, onConnectGoogle, onRevokeGoogle, busy }) {
  const isGoogle = provider === 'Google';
  const [step, setStep] = useState(0);

  useEffect(()=>{
    if (!open) setStep(0);
  }, [open]);

  const start = async () => {
    setStep(1);
    if (isGoogle) {
      await onConnectGoogle();
      setStep(2);
      onClose();
    } else {
      setTimeout(()=>{ setStep(2); onClose(); }, 1200);
    }
  };

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          {step === 0 && (<>
            <Text style={styles.modalTitle}>Connect {provider}</Text>
            <Text style={styles.modalSub}>
              {isGoogle ? 'Sign in with Google to fetch your basic profile.' : 'Mock only in this build.'}
            </Text>
            <View style={styles.rowEnd}>
              <Button title="Cancel" onPress={onClose} outline />
              <Button title={isGoogle ? "Sign in with Google" : "Continue"} onPress={start} disabled={busy} />
            </View>
            {isGoogle && (
              <View style={{marginTop:10}}>
                <Text style={styles.small}>Requires setting EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env</Text>
              </View>
            )}
          </>)}

          {step === 1 && (<View style={styles.center}><ActivityIndicator size="large" /><Text style={styles.modalSub}>Opening secure sign-in…</Text></View>)}
          {step === 2 && (<View style={styles.center}><Text style={styles.success}>✓ {provider} connected</Text></View>)}

          {isGoogle && (<View style={{marginTop:12}}><Button title="Revoke Google Access" onPress={onRevokeGoogle} outline /></View>)}
        </View>
      </View>
    </Modal>
  );
}

function Button({ title, onPress, outline, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({pressed}) => [
      outline? styles.btnOutline:styles.btn,
      pressed && !disabled && {opacity:0.85},
      disabled && {opacity:0.5}
    ]}>
      <Text style={outline? styles.btnOutlineText:styles.btnText}>{title}</Text>
    </Pressable>
  );
}
function Chip({ label }) {
  return <View style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F3F4F6', padding:16, paddingTop:48 },
  card:{ backgroundColor:'white', padding:16, borderRadius:16, marginBottom:12 },
  h1:{ fontSize:22, fontWeight:'700' },
  h2:{ fontSize:18, fontWeight:'700' },
  sub:{ color:'#555', marginTop:6 },
  subSmall:{ color:'#555', marginTop:6, marginBottom:6 },
  row:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 },
  rowBetween:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  btn:{ backgroundColor:'#2563EB', paddingVertical:10, paddingHorizontal:14, borderRadius:10 },
  btnText:{ color:'white', fontWeight:'600' },
  btnOutline:{ borderWidth:1, borderColor:'#D1D5DB', paddingVertical:10, paddingHorizontal:14, borderRadius:10 },
  btnOutlineText:{ color:'#111827', fontWeight:'600' },
  chip:{ backgroundColor:'#DCFCE7', paddingVertical:4, paddingHorizontal:8, borderRadius:9999 },
  chipText:{ color:'#166534', fontWeight:'600', fontSize:12 },
  modalBackdrop:{ flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', padding:16 },
  modalCard:{ backgroundColor:'white', borderRadius:16, padding:16 },
  modalTitle:{ fontSize:18, fontWeight:'700' },
  modalSub:{ color:'#444', marginTop:4, marginBottom:8 },
  rowEnd:{ flexDirection:'row', justifyContent:'flex-end', gap:8 },
  small:{ color:'#6B7280' },
  center:{ alignItems:'center', justifyContent:'center', paddingVertical:16 },
  success:{ color:'green', fontWeight:'700', fontSize:18 }
});
