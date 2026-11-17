import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { hashPassword } from '../utils/crypto';

export default function AdminUsersPage() {
  const [admins, setAdmins] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAdmins = async () => {
    const q = query(collection(db, 'admins'), orderBy('name'));
    const snapshot = await getDocs(q);
    setAdmins(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setLoading(true);
    try {
      const hashedPassword = await hashPassword(password);
      await addDoc(collection(db, 'admins'), {
        name,
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setEmail('');
      setPassword('');
      fetchAdmins();
      alert('管理者を追加しました。');
    } catch (err) {
      console.error(err);
      alert('追加に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('本当にこの管理者身を削除しますか？')) return;
    try {
      await deleteDoc(doc(db, 'admins', id));
      fetchAdmins();
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>管理者ユーザー管理</h2>

      {/* 新規登録フォーム */}
      <form onSubmit={handleCreate} style={{ background: '#fff', padding: '20px', borderRadius: '8px', marginBottom: '20px', maxWidth: '500px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <h3>新規管理者追加</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>名前: </label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '6px' }} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>メールアドレス: </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '6px' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>初期パスワード: </label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '6px' }} />
        </div>
        <button type="submit" disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px' }}>
          {loading ? '登録中...' : '登録する'}
        </button>
      </form>

      {/* 一覧テーブル */}
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr style={{ background: '#f1f1f1', textAlign: 'left' }}>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>名前</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>メールアドレス</th>
            <th style={{ padding: '10px', border: '1px solid #ddd' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {admins.map(admin => (
            <tr key={admin.id}>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{admin.name}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>{admin.email}</td>
              <td style={{ padding: '10px', border: '1px solid #ddd' }}>
                <button onClick={() => handleDelete(admin.id)} style={{ padding: '5px 10px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px' }}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}