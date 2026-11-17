import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const InstructorsPage = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

  // ★追加: 検索フィルター用の状態
  const [filters, setFilters] = useState({
    role: 'すべて',
    name: '',
    activityName: '',
    kana: '',
    email: '',
    memberNo: ''
  });

  // 編集モーダル用の状態
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);

  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'instructors'));
      const instructorList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setInstructors(instructorList);
    } catch (error) {
      console.error('代表者データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  // 編集モーダルを開く
  const handleOpenEditModal = (inst) => {
    setEditingInstructor({
      ...inst,
      role: inst.role || 'ZIN',
      activityName: inst.activityName || ''
    });
    setIsModalOpen(true);
  };

  // 入力値変更（編集モーダル用）
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditingInstructor({
      ...editingInstructor,
      [name]: value
    });
  };

  // ★追加: 検索フィルターの入力変更
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  // 検索フィルターをクリア
  const handleClearFilters = () => {
    setFilters({
      role: 'すべて',
      name: '',
      activityName: '',
      kana: '',
      email: '',
      memberNo: ''
    });
  };

  // 更新保存処理
  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingInstructor.name) return alert('代表者名を入力してください');

    try {
      const docRef = doc(db, 'instructors', editingInstructor.id);
      await updateDoc(docRef, {
        activityName: editingInstructor.activityName || '',
        name: editingInstructor.name,
        kana: editingInstructor.kana || '',
        email: editingInstructor.email || '',
        memberNo: editingInstructor.memberNo || '',
        role: editingInstructor.role || 'ZIN'
      });

      setIsModalOpen(false);
      fetchInstructors();
      alert('代表者情報を更新しました！');
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました。');
    }
  };

  // 区分に応じたバッジスタイルを返すヘルパー関数
  const getRoleBadgeStyle = (role) => {
    const currentRole = role || 'ZIN';
    if (currentRole === 'ZES') {
      return { ...styles.badge, backgroundColor: '#dbeafe', color: '#1d4ed8' };
    }
    if (currentRole === 'JAMMER') {
      return { ...styles.badge, backgroundColor: '#fef3c7', color: '#b45309' };
    }
    return { ...styles.badge, backgroundColor: '#f1f5f9', color: '#475569' };
  };

  // ★追加: AND条件でのフィルタリング処理
  const filteredInstructors = instructors.filter((inst) => {
    // 1. 区分フィルター
    if (filters.role !== 'すべて') {
      const instRole = inst.role || 'ZIN';
      if (instRole !== filters.role) return false;
    }

    // 2. 活動名 (部分一致)
    if (filters.activityName.trim() !== '') {
      const target = (inst.activityName || '').toLowerCase();
      if (!target.includes(filters.activityName.toLowerCase().trim())) return false;
    }

    // 3. 代表者名 (部分一致・大文字小文字無視)
    if (filters.name.trim() !== '') {
      const target = (inst.name || '').toLowerCase();
      if (!target.includes(filters.name.toLowerCase().trim())) return false;
    }

    // 4. ふりがな (部分一致)
    if (filters.kana.trim() !== '') {
      const target = (inst.kana || '').toLowerCase();
      if (!target.includes(filters.kana.toLowerCase().trim())) return false;
    }

    // 5. Email (部分一致)
    if (filters.email.trim() !== '') {
      const target = (inst.email || '').toLowerCase();
      if (!target.includes(filters.email.toLowerCase().trim())) return false;
    }

    // 6. 会員No (部分一致)
    if (filters.memberNo.trim() !== '') {
      const target = (inst.memberNo || '').toLowerCase();
      if (!target.includes(filters.memberNo.toLowerCase().trim())) return false;
    }

    return true; // すべての条件を通過したら表示
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>代表者一覧</h1>
      </div>

      {/* --- 検索フィルターエリア --- */}
      <div style={styles.filterCard}>
        <div style={styles.filterHeader}>
          <span style={{ fontWeight: 'bold', color: '#1e293b' }}>🔍 検索フィルター（AND条件）</span>
          <button onClick={handleClearFilters} style={styles.clearBtn}>条件クリア</button>
        </div>
        <div style={styles.filterGrid}>
          <label style={styles.filterLabel}>
            区分:
            <select
              name="role"
              value={filters.role}
              onChange={handleFilterChange}
              style={styles.input}
            >
              <option value="すべて">すべて</option>
              <option value="ZIN">ZIN</option>
              <option value="ZES">ZES</option>
              <option value="JAMMER">JAMMER</option>
            </select>
          </label>

          <label style={styles.filterLabel}>
            活動名:
            <input
              type="text"
              name="activityName"
              value={filters.activityName}
              onChange={handleFilterChange}
              placeholder="例: サークル名"
              style={styles.input}
            />
          </label>

          <label style={styles.filterLabel}>
            代表者名:
            <input
              type="text"
              name="name"
              value={filters.name}
              onChange={handleFilterChange}
              placeholder="例: 山田"
              style={styles.input}
            />
          </label>

          <label style={styles.filterLabel}>
            ふりがな:
            <input
              type="text"
              name="kana"
              value={filters.kana}
              onChange={handleFilterChange}
              placeholder="例: やまだ"
              style={styles.input}
            />
          </label>

          <label style={styles.filterLabel}>
            Email:
            <input
              type="text"
              name="email"
              value={filters.email}
              onChange={handleFilterChange}
              placeholder="例: @example.com"
              style={styles.input}
            />
          </label>

          <label style={styles.filterLabel}>
            会員No:
            <input
              type="text"
              name="memberNo"
              value={filters.memberNo}
              onChange={handleFilterChange}
              placeholder="例: 1234"
              style={styles.input}
            />
          </label>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.countInfo}>
          <strong>一致件数:</strong> {filteredInstructors.length} 名 
          <span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '8px' }}>
            （登録総数: {instructors.length} 名）
          </span>
          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '10px' }}>
            （行をクリックすると編集できます）
          </span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>LID</th>
                <th style={styles.th}>区分</th>
                <th style={styles.th}>活動名</th>
                <th style={styles.th}>代表者名</th>
                <th style={styles.th}>ふりがな</th>
                <th style={styles.th}>Emailアドレス</th>
                <th style={styles.th}>会員No</th>
                <th style={styles.th}>登録日</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={styles.emptyTd}>読み込み中...</td>
                </tr>
              ) : filteredInstructors.length === 0 ? (
                <tr>
                  <td colSpan="8" style={styles.emptyTd}>
                    条件に一致する代表者情報はありません。
                  </td>
                </tr>
              ) : (
                filteredInstructors.map((inst) => (
                  <tr 
                    key={inst.id} 
                    onClick={() => handleOpenEditModal(inst)} 
                    style={styles.clickableRow}
                  >
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{inst.lid}</td>
                    <td style={styles.td}>
                      <span style={getRoleBadgeStyle(inst.role)}>
                        {inst.role || 'ZIN'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, color: '#475569' }}>{inst.activityName || '-'}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{inst.name}</td>
                    <td style={styles.td}>{inst.kana || '-'}</td>
                    <td style={styles.td}>{inst.email || '-'}</td>
                    <td style={styles.td}>{inst.memberNo || '-'}</td>
                    <td style={styles.td}>{inst.createdAt || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- 編集モーダル --- */}
      {isModalOpen && editingInstructor && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.25rem', color: '#0f172a' }}>
              代表者情報の編集 ({editingInstructor.lid})
            </h2>
            <form onSubmit={handleSave} style={styles.form}>
              <label style={styles.label}>
                LID (変更不可):
                <input
                  type="text"
                  value={editingInstructor.lid}
                  disabled
                  style={{ ...styles.input, backgroundColor: '#f1f5f9', color: '#64748b' }}
                />
              </label>

              <label style={styles.label}>
                区分:
                <select
                  name="role"
                  value={editingInstructor.role || 'ZIN'}
                  onChange={handleChange}
                  style={styles.input}
                >
                  <option value="ZIN">ZIN</option>
                  <option value="ZES">ZES</option>
                  <option value="JAMMER">JAMMER</option>
                </select>
              </label>

              <label style={styles.label}>
                活動名:
                <input
                  type="text"
                  name="activityName"
                  value={editingInstructor.activityName || ''}
                  onChange={handleChange}
                  placeholder="例: サークル名やアーティスト名など"
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                代表者名:
                <input
                  type="text"
                  name="name"
                  value={editingInstructor.name}
                  onChange={handleChange}
                  required
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                代表者フリガナ:
                <input
                  type="text"
                  name="kana"
                  value={editingInstructor.kana}
                  onChange={handleChange}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Emailアドレス:
                <input
                  type="email"
                  name="email"
                  value={editingInstructor.email}
                  onChange={handleChange}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                会員No:
                <input
                  type="text"
                  name="memberNo"
                  value={editingInstructor.memberNo}
                  onChange={handleChange}
                  style={styles.input}
                />
              </label>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={styles.cancelBtn}
                >
                  キャンセル
                </button>
                <button type="submit" style={styles.submitBtn}>
                  変更を保存
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
  header: {
    marginBottom: '20px'
  },
  title: {
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0
  },
  filterCard: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  filterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  clearBtn: {
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '12px'
  },
  filterLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.82rem',
    color: '#475569',
    fontWeight: 'bold'
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
  },
  countInfo: {
    fontSize: '1.05rem',
    color: '#1e293b',
    marginBottom: '16px'
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
  tr: {
    borderBottom: '1px solid #f1f5f9'
  },
  clickableRow: {
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  },
  td: {
    padding: '14px',
    color: '#334155',
    whiteSpace: 'nowrap'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '9999px',
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
    padding: '30px',
    borderRadius: '12px',
    width: '460px',
    maxWidth: '90%'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontSize: '0.88rem',
    color: '#334155',
    fontWeight: 'bold'
  },
  input: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontWeight: 'normal',
    fontSize: '0.9rem',
    backgroundColor: '#ffffff'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '15px'
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#fff',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default InstructorsPage;