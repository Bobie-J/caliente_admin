import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

const SongsPage = () => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 絞り込み・検索ステート
  const [filterType, setFilterType] = useState('all'); // 'all' | 'ZIN' | 'MM'
  const [searchKeyword, setSearchKeyword] = useState('');

  // 新規作成・編集モーダルステート
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSongId, setEditingSongId] = useState(null); // null の場合は新規作成
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    zinOrMm: 'ZIN',
    discNo: '',
    title: '',
    genre: '',
    duration: ''
  });

  // Firestoreから曲一覧を取得
  const fetchSongs = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'songs'));
      const songList = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      // ZIN/MM → DiscNo 順に軽くソート
      songList.sort((a, b) => {
        const typeCompare = (a.zinOrMm || '').localeCompare(b.zinOrMm || '');
        if (typeCompare !== 0) return typeCompare;
        return String(a.discNo || '').localeCompare(String(b.discNo || ''), undefined, { numeric: true });
      });
      setSongs(songList);
    } catch (error) {
      console.error('曲データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // 新規登録モーダルを開く
  const handleOpenCreateModal = () => {
    setEditingSongId(null);
    setFormData({
      zinOrMm: 'ZIN',
      discNo: '',
      title: '',
      genre: '',
      duration: ''
    });
    setIsModalOpen(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (song) => {
    setEditingSongId(song.id);
    setFormData({
      zinOrMm: song.zinOrMm || 'ZIN',
      discNo: song.discNo || '',
      title: song.title || '',
      genre: song.genre || '',
      duration: song.duration || ''
    });
    setIsModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // 保存処理（新規・更新共通）
  const handleSaveSong = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return alert('曲名を入力してください。');

    try {
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];

      if (editingSongId) {
        // 更新
        const songRef = doc(db, 'songs', editingSongId);
        await updateDoc(songRef, {
          zinOrMm: formData.zinOrMm.trim(),
          discNo: formData.discNo.trim(),
          title: formData.title.trim(),
          genre: formData.genre.trim(),
          duration: formData.duration.trim(),
          updatedAt: today
        });
        alert('曲情報を更新しました！');
      } else {
        // 新規登録
        await addDoc(collection(db, 'songs'), {
          zinOrMm: formData.zinOrMm.trim(),
          discNo: formData.discNo.trim(),
          title: formData.title.trim(),
          genre: formData.genre.trim(),
          duration: formData.duration.trim(),
          createdAt: today,
          updatedAt: today
        });
        alert('新しい曲を登録しました！');
      }

      setIsModalOpen(false);
      fetchSongs();
    } catch (error) {
      console.error('保存エラー:', error);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  // 削除処理
  const handleDeleteSong = async () => {
    if (!editingSongId) return;
    if (!window.confirm(`「${formData.title}」を削除してもよろしいですか？`)) return;

    try {
      setSaving(true);
      await deleteDoc(doc(db, 'songs', editingSongId));
      setIsModalOpen(false);
      fetchSongs();
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  // フィルタリング処理
  const filteredSongs = songs.filter((song) => {
    const matchType =
      filterType === 'all' ||
      (song.zinOrMm || '').toUpperCase() === filterType.toUpperCase();

    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return matchType;

    const matchKeyword =
      (song.title || '').toLowerCase().includes(kw) ||
      (song.discNo || '').toLowerCase().includes(kw) ||
      (song.genre || '').toLowerCase().includes(kw) ||
      (song.zinOrMm || '').toLowerCase().includes(kw);

    return matchType && matchKeyword;
  });

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>曲管理</h1>
        <button onClick={handleOpenCreateModal} style={styles.primaryBtn}>
          + 新規曲登録
        </button>
      </div>

      <div style={styles.card}>
        {/* フィルター・検索バー */}
        <div style={styles.filterBar}>
          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
            表示件数: {filteredSongs.length} 曲（全 {songs.length} 曲中）
            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>
              （行をクリックすると編集・削除ができます）
            </span>
          </div>

          <div style={styles.filterControls}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={styles.selectSmall}
            >
              <option value="all">すべて (ZIN / MM)</option>
              <option value="ZIN">ZIN のみ</option>
              <option value="MM">MM のみ</option>
            </select>

            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="DiscNo・曲名・ジャンルで検索..."
              style={styles.searchInput}
            />

            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                style={styles.clearBtn}
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* 曲一覧テーブル */}
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '12%' }}>ZIN / MM</th>
                <th style={{ ...styles.th, width: '12%' }}>DiscNo</th>
                <th style={{ ...styles.th, width: '36%' }}>曲名</th>
                <th style={{ ...styles.th, width: '18%' }}>ジャンル</th>
                <th style={{ ...styles.th, width: '10%' }}>長さ (MM:SS)</th>
                <th style={{ ...styles.th, width: '12%' }}>登録日</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={styles.emptyTd}>読み込み中...</td>
                </tr>
              ) : filteredSongs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.emptyTd}>
                    {searchKeyword || filterType !== 'all'
                      ? '条件に一致する曲が見つかりませんでした。'
                      : '登録されている曲はありません。「+ 新規曲登録」またはCSVインポートから登録してください。'}
                  </td>
                </tr>
              ) : (
                filteredSongs.map((song) => (
                  <tr
                    key={song.id}
                    onClick={() => handleOpenEditModal(song)}
                    style={styles.clickableRow}
                  >
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: (song.zinOrMm || '').toUpperCase() === 'ZIN' ? '#dbeafe' : '#fef3c7',
                          color: (song.zinOrMm || '').toUpperCase() === 'ZIN' ? '#1e40af' : '#92400e'
                        }}
                      >
                        {song.zinOrMm || '-'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{song.discNo || '-'}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#0f172a' }}>{song.title}</td>
                    <td style={styles.td}>{song.genre || '-'}</td>
                    <td style={styles.td}>{song.duration || '-'}</td>
                    <td style={styles.td}>{song.createdAt || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 新規登録・編集モーダル */}
      {isModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                {editingSongId ? '曲情報の編集' : '新規曲の登録'}
              </h2>
              {editingSongId && (
                <button
                  type="button"
                  onClick={handleDeleteSong}
                  disabled={saving}
                  style={styles.deleteBtn}
                >
                  削除
                </button>
              )}
            </div>

            <form onSubmit={handleSaveSong} style={styles.form}>
              <div style={styles.rowInputs}>
                <label style={{ ...styles.label, flex: 1 }}>
                  ZIN or MM <span style={styles.required}>*</span>
                  <select
                    name="zinOrMm"
                    value={formData.zinOrMm}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="ZIN">ZIN</option>
                    <option value="MM">MM</option>
                  </select>
                </label>

                <label style={{ ...styles.label, flex: 1 }}>
                  DiscNo <span style={styles.required}>*</span>
                  <input
                    type="text"
                    name="discNo"
                    value={formData.discNo}
                    onChange={handleChange}
                    placeholder="例: 105"
                    required
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.label}>
                曲名 <span style={styles.required}>*</span>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="例: Caliente Rhythm"
                  required
                  style={styles.input}
                />
              </label>

              <div style={styles.rowInputs}>
                <label style={{ ...styles.label, flex: 2 }}>
                  ジャンル
                  <input
                    type="text"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    placeholder="例: Salsa / Merengue"
                    style={styles.input}
                  />
                </label>

                <label style={{ ...styles.label, flex: 1 }}>
                  曲の長さ (MM:SS)
                  <input
                    type="text"
                    name="duration"
                    value={formData.duration}
                    onChange={handleChange}
                    placeholder="例: 03:45"
                    style={styles.input}
                  />
                </label>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  キャンセル
                </button>
                <button type="submit" disabled={saving} style={styles.submitBtn}>
                  {saving ? '保存中...' : editingSongId ? '変更を保存' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px 30px',
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
    fontFamily: 'sans-serif'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0
  },
  primaryBtn: {
    backgroundColor: '#f6b179',
    color: '#1e293b',
    border: 'none',
    padding: '10px 22px',
    borderRadius: '8px',
    fontSize: '0.92rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px'
  },
  filterControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },
  selectSmall: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    backgroundColor: '#fff'
  },
  searchInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.88rem',
    width: '240px'
  },
  clearBtn: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    fontSize: '0.82rem',
    cursor: 'pointer'
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
    fontSize: '0.88rem'
  },
  th: {
    backgroundColor: '#f6b179',
    color: '#1e293b',
    padding: '12px 14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap'
  },
  clickableRow: {
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer'
  },
  td: {
    padding: '14px',
    color: '#334155',
    whiteSpace: 'nowrap'
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '0.78rem',
    fontWeight: 'bold'
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center',
    color: '#94a3b8'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    background: '#ffffff',
    padding: '28px',
    borderRadius: '12px',
    width: '480px',
    maxWidth: '92%'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  rowInputs: {
    display: 'flex',
    gap: '12px'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    fontSize: '0.88rem',
    fontWeight: 'bold',
    color: '#334155'
  },
  required: {
    color: '#ef4444'
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    fontWeight: 'normal',
    backgroundColor: '#fff'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '14px'
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '8px 18px',
    borderRadius: '6px',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  deleteBtn: {
    padding: '5px 12px',
    borderRadius: '6px',
    border: '1px solid #fca5a5',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '0.82rem',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};

export default SongsPage;