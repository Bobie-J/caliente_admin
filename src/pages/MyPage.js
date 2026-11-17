import React, { useState } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { hashPassword } from '../utils/crypto';

export default function MyPage() {
  const { adminUser, login } = useAuth();
  const [name, setName] = useState(adminUser?.name || '');
  const [email, setEmail] = useState(adminUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      const adminRef = doc(db, 'admins', adminUser.id);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) return;

      const currentData = adminSnap.data();
      const hashedCurrent = await hashPassword(currentPassword);

      if (currentData.password !== hashedCurrent) {
        setMessage('現在のパスワードが正しくありません。');
        return;
      }

      const updateData = { name, email };
      if (newPassword) {
        updateData.password = await hashPassword(newPassword);
      }

      await updateDoc(adminRef, updateData);

      // セッション情報も更新
      login({ ...adminUser, name, email });
      setMessage('プロフィールを更新しました！');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      console.error(err);
      setMessage('更新に失敗しました。');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px' }}>
      <h2>マイページ（アカウント設定）</h2>
      {message && <div style={{ marginBottom: '15px', padding: '10px', background: '#e2f0d9', color: '#385723' }}>{message}</div>}
      <form onSubmit={handleUpdate} style={{ background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '15px' }}>
          <label>名前: </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>メールアドレス: </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid #eee' }} />
        <div style={{ marginBottom: '15px' }}>
          <label>現在のパスワード（確認用・必須）: </label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required style={{ width: '100%', padding: '8px' }} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>新しいパスワード（変更する場合のみ）: </label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', padding: '8px' }} />
        </div>
        <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px' }}>
          変更を保存
        </button>
      </form>
    </div>
  );
}