import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', 'Nagano', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県', 'その他'
].map(p => p === 'Nagano' ? '長野県' : p); // 念のため修正

const EventsPage = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 絞り込みフィルター用の状態
  const [filterYear, setFilterYear] = useState('all');
  const [filterPrefecture, setFilterPrefecture] = useState('all');

  const [formData, setFormData] = useState({
    name: '',
    prefecture: '東京都', // デフォルト
    location: '',       // 会場名
    isPublic: true,
    eventDate: '',
    startTime: '',
    endTime: '',
    registerStart: '',
    registerEnd: '',
    minMembers: 1, // 追加：下限
    maxMembers: 9  // 追加：上限
  });

  // Firestoreからイベント一覧を取得
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventList);
    } catch (error) {
      console.error("データ取得エラー:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // Firestoreへデータを新規登録
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!formData.name) return alert('カリエンテ名を入力してください');

    try {
      await addDoc(collection(db, "events"), {
        ...formData,
        teamCount: 0,
        createdAt: serverTimestamp()
      });

      setIsModalOpen(false);
      setFormData({
        name: '', prefecture: '東京都', location: '', isPublic: true,
        eventDate: '', startTime: '', endTime: '',
        registerStart: '', registerEnd: ''
      });
      
      fetchEvents();
      alert('Firestoreに保存されました！');
    } catch (error) {
      console.error("保存エラー:", error);
      alert('保存に失敗しました。');
    }
  };

  const handleRowClick = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  // 本日の日付（YYYY-MM-DD）
  const todayStr = new Date().toISOString().split('T')[0];

  // 絞り込み処理の適用
  const filteredEvents = events.filter(event => {
    const eventYear = event.eventDate ? event.eventDate.split('-')[0] : '';
    const matchYear = filterYear === 'all' || eventYear === filterYear;
    const matchPref = filterPrefecture === 'all' || event.prefecture === filterPrefecture;
    return matchYear && matchPref;
  });

  // 本日以降開催分 と 過去開催分 に振り分け
  const upcomingEvents = filteredEvents.filter(event => !event.eventDate || event.eventDate >= todayStr);
  const pastEvents = filteredEvents.filter(event => event.eventDate && event.eventDate < todayStr);

  // フィルター用：登録されているイベントから存在する年を抽出
  const availableYears = Array.from(new Set(events.map(e => e.eventDate ? e.eventDate.split('-')[0] : '').filter(Boolean))).sort().reverse();

  return (
    <div style={styles.eventsContainer}>
      <div style={styles.eventsHeader}>
        <h1 style={styles.title}>
          カリエンテ一覧 <span style={styles.subTitle}>| 本日以降開催分</span>
        </h1>
      </div>

      {/* --- 絞り込みフィルターバー --- */}
      <div style={styles.filterBar}>
        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>開催年:</label>
          <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={styles.select}>
            <option value="all">すべて</option>
            {availableYears.map(year => (
              <option key={year} value={year}>{year}年</option>
            ))}
          </select>
        </div>

        <div style={styles.filterItem}>
          <label style={styles.filterLabel}>都道府県:</label>
          <select value={filterPrefecture} onChange={(e) => setFilterPrefecture(e.target.value)} style={styles.select}>
            <option value="all">すべて</option>
            {PREFECTURES.map(pref => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- 本日以降開催分のテーブル --- */}
      <div style={styles.tableWrapper}>
        <table style={styles.eventsTable}>
          <thead>
            <tr>
              <th style={styles.th}>カリエンテ名</th>
              <th style={styles.th}>都道府県</th>
              <th style={styles.th}>会場</th>
              <th style={styles.th}>公開設定</th>
              <th style={styles.th}>チーム数</th>
              <th style={styles.th}>開催日</th>
              <th style={styles.th}>開始時刻</th>
              <th style={styles.th}>終了時刻</th>
              <th style={styles.th}>登録開始</th>
              <th style={styles.th}>登録終了</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="10" style={styles.emptyTd}>読み込み中...</td></tr>
            ) : upcomingEvents.length === 0 ? (
              <tr>
                <td colSpan="10" style={styles.emptyTd}>
                  条件に該当する本日以降のカリエンテはありません。
                </td>
              </tr>
            ) : (
              upcomingEvents.map((event) => (
                <tr key={event.id} onClick={() => handleRowClick(event.id)} style={styles.clickableRow}>
                  <td style={{ ...styles.td, fontWeight: 'bold' }}>{event.name}</td>
                  <td style={styles.td}>{event.prefecture || '-'}</td>
                  <td style={styles.td}>{event.location || '-'}</td>
                  <td style={styles.td}>{event.isPublic ? '✔' : '-'}</td>
                  <td style={styles.td}>{event.teamCount || 0}</td>
                  <td style={styles.td}>{event.eventDate || '-'}</td>
                  <td style={styles.td}>{event.startTime || '-'}</td>
                  <td style={styles.td}>{event.endTime || '-'}</td>
                  <td style={styles.td}>{event.registerStart || '-'}</td>
                  <td style={styles.td}>{event.registerEnd || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- 新規作成ボタンエリア --- */}
      <div style={styles.actionArea}>
        <button style={styles.createBtn} onClick={() => setIsModalOpen(true)}>
          <span>📅</span> カリエンテを作成する
        </button>
      </div>

      {/* --- 過去開催分のテーブル（新規作成ボタンの下） --- */}
      <div style={{ marginTop: '40px' }}>
        <h2 style={styles.sectionSubTitle}>過去開催分のカリエンテ一覧</h2>
        <div style={styles.tableWrapper}>
          <table style={styles.eventsTable}>
            <thead>
              <tr>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>カリエンテ名</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>都道府県</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>会場</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>公開設定</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>チーム数</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>開催日</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>開始時刻</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>終了時刻</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>登録開始</th>
                <th style={{ ...styles.th, backgroundColor: '#cbd5e1' }}>登録終了</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" style={styles.emptyTd}>読み込み中...</td></tr>
              ) : pastEvents.length === 0 ? (
                <tr>
                  <td colSpan="10" style={styles.emptyTd}>
                    過去開催分のカリエンテはありません。
                  </td>
                </tr>
              ) : (
                pastEvents.map((event) => (
                  <tr key={event.id} onClick={() => handleRowClick(event.id)} style={styles.clickableRow}>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#64748b' }}>{event.name}</td>
                    <td style={styles.td}>{event.prefecture || '-'}</td>
                    <td style={styles.td}>{event.location || '-'}</td>
                    <td style={styles.td}>{event.isPublic ? '✔' : '-'}</td>
                    <td style={styles.td}>{event.teamCount || 0}</td>
                    <td style={styles.td}>{event.eventDate || '-'}</td>
                    <td style={styles.td}>{event.startTime || '-'}</td>
                    <td style={styles.td}>{event.endTime || '-'}</td>
                    <td style={styles.td}>{event.registerStart || '-'}</td>
                    <td style={styles.td}>{event.registerEnd || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* モーダル部分 */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2>新規カリエンテ作成</h2>
            <form onSubmit={handleCreateEvent} style={styles.form}>
              <label style={styles.label}>
                カリエンテ名:
                <input type="text" name="name" value={formData.name} onChange={handleChange} required style={styles.input} />
              </label>

              <div style={styles.rowInputs}>
                <label style={styles.label}>
                  都道府県:
                  <select name="prefecture" value={formData.prefecture} onChange={handleChange} style={styles.input}>
                    {PREFECTURES.map(pref => (
                      <option key={pref} value={pref}>{pref}</option>
                    ))}
                  </select>
                </label>
                <label style={{ ...styles.label, flex: 2 }}>
                  会場:
                  <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="例: パシフィコ横浜" style={styles.input} />
                </label>
              </div>

              <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center' }}>
                <input type="checkbox" name="isPublic" checked={formData.isPublic} onChange={handleChange} />
                表ページに公開する
              </label>
              <div style={styles.rowInputs}>
                <label style={styles.label}>開催日: <input type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} style={styles.input} /></label>
                <label style={styles.label}>開始: <input type="time" name="startTime" value={formData.startTime} onChange={handleChange} style={styles.input} /></label>
                <label style={styles.label}>終了: <input type="time" name="endTime" value={formData.endTime} onChange={handleChange} style={styles.input} /></label>
              </div>
              <div style={styles.rowInputs}>
                <label style={styles.label}>登録開始日: <input type="date" name="registerStart" value={formData.registerStart} onChange={handleChange} style={styles.input} /></label>
                <label style={styles.label}>登録終了日: <input type="date" name="registerEnd" value={formData.registerEnd} onChange={handleChange} style={styles.input} /></label>
              </div>
              <div style={styles.rowInputs}>
                <label style={styles.label}>
                  メンバー下限数:
                  <input type="number" name="minMembers" value={formData.minMembers} onChange={handleChange} min="1" style={styles.input} />
                </label>
                <label style={styles.label}>
                  メンバー上限数:
                  <input type="number" name="maxMembers" value={formData.maxMembers} onChange={handleChange} min="1" style={styles.input} />
                </label>
              </div>
              <div style={styles.modalActions}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={styles.cancelBtn}>キャンセル</button>
                <button type="submit" style={styles.submitBtn}>作成する</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  eventsContainer: { padding: '10px 20px', fontFamily: 'sans-serif' },
  eventsHeader: { marginBottom: '15px' },
  title: { fontSize: '1.5rem', fontWeight: 'bold', color: '#1e293b', margin: 0 },
  subTitle: { fontSize: '1.1rem', color: '#64748b', fontWeight: 'normal' },
  filterBar: { display: 'flex', gap: '20px', marginBottom: '15px', background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px' },
  filterItem: { display: 'flex', alignItems: 'center', gap: '8px' },
  filterLabel: { fontSize: '0.9rem', fontWeight: 'bold', color: '#334155' },
  select: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.9rem' },
  sectionSubTitle: { fontSize: '1.2rem', fontWeight: 'bold', color: '#334155', marginBottom: '10px' },
  tableWrapper: { background: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  eventsTable: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' },
  th: { backgroundColor: '#f6b179', color: '#1e293b', padding: '14px 16px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  td: { padding: '16px', borderBottom: '1px solid #f1f5f9', color: '#334155', whiteSpace: 'nowrap' },
  emptyTd: { padding: '30px', textAlign: 'center', color: '#94a3b8' },
  clickableRow: { cursor: 'pointer', transition: 'background-color 0.15s ease' },
  actionArea: { display: 'flex', justifyContent: 'center', margin: '30px 0' },
  createBtn: { backgroundColor: '#f6b179', color: '#1e293b', border: 'none', padding: '12px 36px', borderRadius: '24px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: '#ffffff', padding: '30px', borderRadius: '12px', width: '520px', maxWidth: '90%' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' },
  label: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.9rem', color: '#334155' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' },
  rowInputs: { display: 'flex', gap: '10px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' },
  cancelBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  submitBtn: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }
};

export default EventsPage;