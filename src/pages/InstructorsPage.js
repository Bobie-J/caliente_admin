import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const InstructorsPage = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

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
    setEditingInstructor({ ...inst });
    setIsModalOpen(true);
  };

  // 入力値変更
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditingInstructor({
      ...editingInstructor,
      [name]: value
    });
  };

  // 更新保存処理
  const handleSave = async (e) => {
    e.preventDefault();
    if (!editingInstructor.name) return alert('代表者名を入力してください');

    try {
      // ドキュメントID（またはlid）を元にFirestoreを更新
      const docRef = doc(db, 'instructors', editingInstructor.id);
      await updateDoc(docRef, {
        name: editingInstructor.name,
        kana: editingInstructor.kana || '',
        email: editingInstructor.email || '',
        memberNo: editingInstructor.memberNo || ''
      });

      setIsModalOpen(false);
      fetchInstructors();
      alert('代表者情報を更新しました！');
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました。');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>代表者（講師）一覧</h1>
      </div>

      <div style={styles.card}>
        <div style={styles.countInfo}>
          <strong>登録総数:</strong> {instructors.length} 名
          <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '10px' }}>
            （行をクリックすると編集できます）
          </span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>LID</th>
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
                  <td colSpan="6" style={styles.emptyTd}>読み込み中...</td>
                </tr>
              ) : instructors.length === 0 ? (
                <tr>
                  <td colSpan="6" style={styles.emptyTd}>
                    登録されている代表者情報はありません。
                  </td>
                </tr>
              ) : (
                instructors.map((inst) => (
                  <tr 
                    key={inst.id} 
                    onClick={() => handleOpenEditModal(inst)} 
                    style={styles.clickableRow}
                  >
                    <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{inst.lid}</td>
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
    fontSize: '0.9rem'
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