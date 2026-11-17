import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { hashPassword } from '../utils/crypto';
import { useAuth } from '../context/AuthContext';
import ReCAPTCHA from 'react-google-recaptcha'; // ★追加

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaValue, setCaptchaValue] = useState(null); // ★追加: reCAPTCHAの状態
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // ★reCAPTCHAのチェックが完了しているか確認
    if (!captchaValue) {
      setError('ロボットではないことの確認（reCAPTCHA）を完了してください。');
      return;
    }

    setLoading(true);

    try {
      const q = query(collection(db, 'admins'), where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('メールアドレスまたはパスワードが間違っています。');
        setLoading(false);
        return;
      }

      const adminDoc = querySnapshot.docs[0];
      const adminData = adminDoc.data();
      const hashedPassword = await hashPassword(password);

      if (adminData.password !== hashedPassword) {
        setError('メールアドレスまたはパスワードが間違っています。');
        setLoading(false);
        return;
      }

      // ログイン成功
      login({
        id: adminDoc.id,
        name: adminData.name,
        email: adminData.email,
      });
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('ログイン処理に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f4f6f8' }}>
      <form onSubmit={handleLogin} style={{ background: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '380px', boxSizing: 'border-box' }}>
        <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>管理者ログイン</h2>
        {error && <div style={{ color: 'red', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        {/* ★reCAPTCHAウィジェットの配置 */}
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <ReCAPTCHA
            sitekey="6LdZKyQuAAAAAF549TwLxqibJiOo6A6y-VI24YRi" // 取得したサイトキーに置き換えてください
            onChange={(value) => setCaptchaValue(value)}
            onExpired={() => setCaptchaValue(null)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>
    </div>
  );
}