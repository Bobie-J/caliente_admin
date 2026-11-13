import React from 'react';
import { Link } from 'react-router-dom';

const AdminTop = () => {
  const cards = [
    { name: 'イベント一覧', path: '/events', desc: '日程・会場の設定、エントリー受付' },
    { name: 'チーム一覧', path: '/teams', desc: '代表者・参加メンバーの確認' },
    { name: '請求', path: '/billing', desc: '参加費の請求・決済ステータス' },
    { name: '講師管理', path: '/instructors', desc: 'ジャッジ・講師情報' },
  ];

  return (
    <div>
      <h1>管理画面 ダッシュボード</h1>
      <p>メニューを選択してください。</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
        {cards.map((card) => (
          <Link to={card.path} key={card.path} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '20px', backgroundColor: '#f8fafc' }}>
              <h3>{card.name}</h3>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>{card.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminTop;
