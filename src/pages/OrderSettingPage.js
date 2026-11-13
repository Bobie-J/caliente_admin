import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

const OrderSettingPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState(null);
  const [teams, setTeams] = useState([]);

  // 現在のステップ管理 (1: 会場・部設定, 2: チーム振り分け)
  const [step, setStep] = useState(1);

  // 会場・部の設定
  const [venues, setVenues] = useState([
    {
      name: 'A会場',
      sections: [{ sectionName: '1部', startTime: '10:00', endTime: '12:00' }]
    }
  ]);

  // 振分操作用の状態
  const [selectedVenue, setSelectedVenue] = useState('A会場');
  const [selectedSection, setSelectedSection] = useState('1部');
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const eventRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        const data = eventSnap.data();
        setEventData(data);
        if (data.venueConfigs && data.venueConfigs.length > 0) {
          setVenues(data.venueConfigs);
          setSelectedVenue(data.venueConfigs[0].name);
          if (data.venueConfigs[0].sections.length > 0) {
            setSelectedSection(data.venueConfigs[0].sections[0].sectionName);
          }
        }
      }

      const teamsRef = collection(db, 'events', eventId, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      const teamList = teamsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));
      setTeams(teamList);
    } catch (err) {
      console.error('データ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- 会場・部の追加・削除ハンドラー ---
  const handleAddVenue = () => {
    const nextChar = String.fromCharCode(65 + venues.length); // A, B, C...
    setVenues([
      ...venues,
      {
        name: `${nextChar}会場`,
        sections: [{ sectionName: '1部', startTime: '10:00', endTime: '12:00' }]
      }
    ]);
  };

  const handleRemoveVenue = (venueIndex) => {
    if (venues.length <= 1) {
      return alert('最低1つの会場が必要です');
    }
    if (window.confirm(`${venues[venueIndex].name} を削除してもよろしいですか？`)) {
      const newVenues = venues.filter((_, idx) => idx !== venueIndex);
      setVenues(newVenues);
    }
  };

  const handleAddSection = (venueIndex) => {
    const newVenues = [...venues];
    const nextNum = newVenues[venueIndex].sections.length + 1;
    newVenues[venueIndex].sections.push({
      sectionName: `${nextNum}部`,
      startTime: '10:00',
      endTime: '12:00'
    });
    setVenues(newVenues);
  };

  const handleRemoveSection = (venueIndex, sectionIndex) => {
    const newVenues = [...venues];
    if (newVenues[venueIndex].sections.length <= 1) {
      return alert('各会場に最低1つの部が必要です');
    }
    newVenues[venueIndex].sections.splice(sectionIndex, 1);
    setVenues(newVenues);
  };

  const handleSectionTimeChange = (vIdx, sIdx, field, value) => {
    const newVenues = [...venues];
    newVenues[vIdx].sections[sIdx][field] = value;
    setVenues(newVenues);
  };

  const handleSaveAndProceed = async () => {
    try {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, { venueConfigs: venues });
      
      // 振り分け選択状態の初期化
      if (venues.length > 0) {
        setSelectedVenue(venues[0].name);
        if (venues[0].sections.length > 0) {
          setSelectedSection(venues[0].sections[0].sectionName);
        }
      }
      setStep(2); // ステップ2（振り分け画面）へ遷移
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  // --- 振り分け操作ハンドラー ---
  const handleToggleSelectTeam = (id) => {
    if (selectedTeamIds.includes(id)) {
      setSelectedTeamIds(selectedTeamIds.filter((tId) => tId !== id));
    } else {
      setSelectedTeamIds([...selectedTeamIds, id]);
    }
  };

  const handleAssignTeams = async () => {
    if (selectedTeamIds.length === 0) {
      return alert('割り振るチームを選択してください');
    }

    try {
      const batch = writeBatch(db);
      selectedTeamIds.forEach((id) => {
        const teamRef = doc(db, 'events', eventId, 'teams', id);
        batch.update(teamRef, {
          venue: selectedVenue,
          section: selectedSection
        });
      });

      await batch.commit();
      setSelectedTeamIds([]);
      fetchData();
    } catch (err) {
      console.error('振分エラー:', err);
      alert('割り振りに失敗しました');
    }
  };

  const handleUnassignTeam = async (teamId) => {
    try {
      const teamRef = doc(db, 'events', eventId, 'teams', teamId);
      await updateDoc(teamRef, {
        venue: '',
        section: ''
      });
      fetchData();
    } catch (err) {
      console.error('解除エラー:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>読み込み中...</div>;
  }

  const unassignedTeams = teams.filter((t) => !t.venue || !t.section);
  const currentAssignedTeams = teams.filter(
    (t) => t.venue === selectedVenue && t.section === selectedSection
  );

  return (
    <div style={styles.container}>
      {/* 画面上部ヘッダー */}
      <div style={styles.topHeader}>
        <button onClick={() => navigate(`/events/${eventId}`)} style={styles.backBtn}>
          ← イベント詳細に戻る
        </button>
        <h1 style={styles.pageTitle}>発表順・会場振り分け設定 ({eventData?.name})</h1>
      </div>

      {/* STEP 1: 会場・部の設定画面 */}
      {step === 1 && (
        <div style={styles.cardFull}>
          <div style={styles.stepHeader}>
            <span style={styles.stepBadge}>STEP 1</span>
            <h2 style={styles.cardTitle}>会場・部・開催時間の設定</h2>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
            まずは今回のイベントで使用する会場数、各会場の部数、およびそれぞれの開催時間を設定してください。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {venues.map((v, vIdx) => (
              <div key={vIdx} style={styles.venueBlock}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#0f172a' }}>{v.name}</h3>
                  <button onClick={() => handleRemoveVenue(vIdx)} style={styles.deleteVenueBtn}>
                    会場を削除
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {v.sections.map((s, sIdx) => (
                    <div key={sIdx} style={styles.sectionRow}>
                      <span style={{ fontWeight: 'bold', width: '60px', color: '#334155' }}>{s.sectionName}</span>
                      <label style={styles.timeLabel}>
                        開始:
                        <input
                          type="time"
                          value={s.startTime}
                          onChange={(e) => handleSectionTimeChange(vIdx, sIdx, 'startTime', e.target.value)}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.timeLabel}>
                        終了:
                        <input
                          type="time"
                          value={s.endTime}
                          onChange={(e) => handleSectionTimeChange(vIdx, sIdx, 'endTime', e.target.value)}
                          style={styles.input}
                        />
                      </label>
                      <button onClick={() => handleRemoveSection(vIdx, sIdx)} style={styles.deleteSectionBtn}>
                        部を削除
                      </button>
                    </div>
                  ))}
                </div>

                <button onClick={() => handleAddSection(vIdx)} style={styles.subBtn}>
                  + {v.name}に部を追加
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
            <button onClick={handleAddVenue} style={styles.subBtn}>
              + 新規会場を追加
            </button>
            <button onClick={handleSaveAndProceed} style={styles.primaryBtn}>
              保存してチーム振り分けへ進む →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: チームの振り分け画面（全幅） */}
      {step === 2 && (
        <div style={styles.cardFull}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div style={styles.stepHeader}>
              <span style={styles.stepBadge}>STEP 2</span>
              <h2 style={styles.cardTitle}>チームの振り分け作業</h2>
            </div>
            <button onClick={() => setStep(1)} style={styles.backStepBtn}>
              ← 会場・部の設定に戻る
            </button>
          </div>

          {/* 会場・部 選択バー */}
          <div style={styles.selectHeader}>
            <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
              <label style={{ fontWeight: 'bold', color: '#1e293b' }}>
                対象会場:
                <select
                  value={selectedVenue}
                  onChange={(e) => {
                    setSelectedVenue(e.target.value);
                    const targetV = venues.find((v) => v.name === e.target.value);
                    if (targetV && targetV.sections.length > 0) {
                      setSelectedSection(targetV.sections[0].sectionName);
                    }
                  }}
                  style={styles.select}
                >
                  {venues.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontWeight: 'bold', color: '#1e293b' }}>
                部:
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  style={styles.select}
                >
                  {venues
                    .find((v) => v.name === selectedVenue)
                    ?.sections.map((s) => (
                      <option key={s.sectionName} value={s.sectionName}>
                        {s.sectionName} ({s.startTime} ～ {s.endTime})
                      </option>
                    ))}
                </select>
              </label>
            </div>
          </div>

          {/* 現在選択中のグループの割当済みチーム */}
          <div style={styles.assignedSection}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>
              【 {selectedVenue} - {selectedSection} 】に割り当て済みのチーム（{currentAssignedTeams.length}件）
            </h4>
            {currentAssignedTeams.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>まだ割り当てられているチームはありません。</p>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {currentAssignedTeams.map((t) => (
                  <span key={t.id} style={styles.tag}>
                    {t.name}
                    <button onClick={() => handleUnassignTeam(t.id)} style={styles.tagRemoveBtn} title="割り当て解除">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 未確定チーム一覧（全幅テーブル） */}
          <div style={{ marginTop: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, color: '#0f172a' }}>
                未確定のチーム一覧（残り {unassignedTeams.length}件）
              </h3>
              <button onClick={handleAssignTeams} style={styles.assignBtn}>
                選択したチームを {selectedVenue} {selectedSection} に追加
              </button>
            </div>

            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: '50px', textAlign: 'center' }}>選択</th>
                    <th style={{ ...styles.th, width: '20%' }}>チーム名</th>
                    <th style={{ ...styles.th, width: '15%' }}>代表者名</th>
                    <th style={{ ...styles.th, width: '15%' }}>希望CD</th>
                    <th style={{ ...styles.th, width: '15%' }}>希望曲</th>
                    <th style={{ ...styles.th, width: '15%' }}>希望曲のジャンル</th>
                    <th style={{ ...styles.th, width: '20%' }}>要望（備考）</th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedTeams.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={styles.emptyTd}>
                        未確定のチームはありません（すべてのチームの振り分けが完了しています）。
                      </td>
                    </tr>
                  ) : (
                    unassignedTeams.map((team) => (
                      <tr key={team.id} style={styles.tr}>
                        <td style={styles.tdCenter}>
                          <input
                            type="checkbox"
                            checked={selectedTeamIds.includes(team.id)}
                            onChange={() => handleToggleSelectTeam(team.id)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                          />
                        </td>
                        <td style={{ ...styles.td, fontWeight: 'bold', color: '#0f172a' }}>{team.name}</td>
                        <td style={styles.td}>{team.leaderName || '-'}</td>
                        <td style={styles.td}>{team.requestedCd || '-'}</td>
                        <td style={styles.td}>{team.requestedSong || '-'}</td>
                        <td style={styles.td}>{team.genre || '-'}</td>
                        <td style={styles.td}>{team.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
  topHeader: {
    marginBottom: '20px'
  },
  backBtn: {
    marginBottom: '10px',
    padding: '6px 14px',
    cursor: 'pointer',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '0.85rem',
    color: '#475569'
  },
  pageTitle: {
    fontSize: '1.6rem',
    fontWeight: 'bold',
    color: '#0f172a',
    margin: 0
  },
  cardFull: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    width: '100%',
    boxSizing: 'border-box'
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    margin: 0
  },
  stepBadge: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  cardTitle: {
    fontSize: '1.25rem',
    margin: 0,
    color: '#1e293b'
  },
  venueBlock: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '18px',
    borderRadius: '10px'
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  timeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.88rem',
    color: '#475569'
  },
  input: {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1'
  },
  select: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    marginLeft: '8px',
    fontSize: '0.9rem'
  },
  subBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginTop: '12px',
    color: '#334155'
  },
  deleteVenueBtn: {
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #fca5a5',
    background: '#fef2f2',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 'bold'
  },
  deleteSectionBtn: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '0.78rem'
  },
  primaryBtn: {
    padding: '10px 22px',
    borderRadius: '8px',
    border: 'none',
    background: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.95rem',
    boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
  },
  backStepBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#475569'
  },
  selectHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    backgroundColor: '#fff7ed',
    borderRadius: '8px',
    border: '1px solid #ffedd5',
    marginBottom: '15px'
  },
  assignedSection: {
    padding: '16px 20px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    padding: '5px 12px',
    borderRadius: '16px',
    fontSize: '0.85rem',
    fontWeight: 'bold'
  },
  tagRemoveBtn: {
    border: 'none',
    background: 'transparent',
    color: '#0369a1',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '1rem',
    lineHeight: 1
  },
  assignBtn: {
    backgroundColor: '#ffb74d',
    color: '#ffffff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
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
  td: {
    padding: '12px 14px',
    color: '#334155',
    whiteSpace: 'nowrap'
  },
  tdCenter: {
    padding: '12px 14px',
    color: '#334155',
    textAlign: 'center'
  },
  emptyTd: {
    padding: '40px',
    textAlign: 'center',
    color: '#94a3b8'
  }
};

export default OrderSettingPage;