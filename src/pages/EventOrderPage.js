import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

const EventOrderPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState(1);

  // 会場・部管理用の入力値
  const [venueConfigs, setVenueConfigs] = useState([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [sectionInputs, setSectionInputs] = useState({});

  // メンバー詳細を開閉するためのステート { [teamId]: true/false }
  const [expandedMembers, setExpandedMembers] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. イベントデータ取得
        const eventSnap = await getDoc(doc(db, 'events', eventId));
        let loadedConfigs = [];
        if (eventSnap.exists()) {
          const eData = eventSnap.data();
          setEventData({ id: eventSnap.id, ...eData });
          if (Array.isArray(eData.venueConfigs) && eData.venueConfigs.length > 0) {
            loadedConfigs = eData.venueConfigs;
          }
        }

        // 2. エントリーチーム取得（新規読込時、まだvenue/sectionが未設定ならデフォルト空＝未所属）
        const teamsSnap = await getDocs(collection(db, 'events', eventId, 'teams'));
        const teamList = teamsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            venue: data.venue || '',
            section: data.section || '',
            selectedSong: data.selectedSong || data.requestedSong1 || ''
          };
        });
        setTeams(teamList);

        // 3. 曲マスタ取得（所要時間計算用）
        const songSnap = await getDocs(collection(db, 'songs'));
        const songList = songSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSongs(songList);

        if (loadedConfigs.length === 0) {
          loadedConfigs = [{
            id: 'v_default',
            name: 'メイン会場',
            sections: [
              { sectionName: '1部', startTime: '10:00', endTime: '12:00' },
              { sectionName: '2部', startTime: '13:00', endTime: '15:00' }
            ]
          }];
        }
        setVenueConfigs(loadedConfigs);
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId]);

  // ==========================================
  // 工程1: 会場・部の追加・削除
  // ==========================================
  const handleAddVenue = () => {
    const trimmed = newVenueName.trim();
    if (!trimmed) return alert('会場名を入力してください。');
    if (venueConfigs.some((v) => v.name === trimmed)) {
      return alert('同じ名前の会場がすでに存在します。');
    }
    setVenueConfigs([...venueConfigs, { id: `v_${Date.now()}`, name: trimmed, sections: [] }]);
    setNewVenueName('');
  };

  const handleRemoveVenue = (venueId, venueName) => {
    const assignedCount = teams.filter((t) => t.venue === venueName).length;
    if (assignedCount > 0) {
      if (!window.confirm(`「${venueName}」には現在 ${assignedCount} チームが所属しています。削除すると未所属になります。よろしいですか？`)) {
        return;
      }
      setTeams(teams.map((t) => (t.venue === venueName ? { ...t, venue: '', section: '', order: '' } : t)));
    }
    setVenueConfigs(venueConfigs.filter((v) => v.id !== venueId));
  };

  const handleAddSection = (venueId) => {
    const inputObj = sectionInputs[venueId] || {};
    const secName = (inputObj.sectionName || '').trim();
    const startTime = inputObj.startTime || '';
    const endTime = inputObj.endTime || '';

    if (!secName) return alert('部名（例: 1部）を入力してください。');

    setVenueConfigs(
      venueConfigs.map((v) => {
        if (v.id !== venueId) return v;
        if (v.sections.some((s) => s.sectionName === secName)) {
          alert('この会場にはすでに同じ名前の部が存在します。');
          return v;
        }
        return {
          ...v,
          sections: [...v.sections, { sectionName: secName, startTime, endTime }]
        };
      })
    );
    setSectionInputs({ ...sectionInputs, [venueId]: { sectionName: '', startTime: '', endTime: '' } });
  };

  const handleRemoveSection = (venueId, venueName, sectionName) => {
    const assignedCount = teams.filter((t) => t.venue === venueName && t.section === sectionName).length;
    if (assignedCount > 0) {
      if (!window.confirm(`「${venueName} - ${sectionName}」には現在 ${assignedCount} チームが所属しています。削除すると未所属になります。よろしいですか？`)) {
        return;
      }
      setTeams(
        teams.map((t) =>
          t.venue === venueName && t.section === sectionName ? { ...t, venue: '', section: '', order: '' } : t
        )
      );
    }
    setVenueConfigs(
      venueConfigs.map((v) =>
        v.id === venueId ? { ...v, sections: v.sections.filter((s) => s.sectionName !== sectionName) } : v
      )
    );
  };

  // ==========================================
  // 工程2: チームごとの行から会場・部を選ぶ
  // ==========================================
  const handleTeamVenueSectionChange = (teamId, combinedVal) => {
    if (!combinedVal) {
      // 未所属にする場合
      setTeams(teams.map((t) => (t.id === teamId ? { ...t, venue: '', section: '', order: '' } : t)));
      return;
    }
    const [vName, sName] = combinedVal.split('__');
    setTeams(
      teams.map((t) =>
        t.id === teamId ? { ...t, venue: vName, section: sName, order: '' } : t
      )
    );
  };

  const handleSelectSong = (teamId, songTitle) => {
    setTeams(
      teams.map((t) => (t.id === teamId ? { ...t, selectedSong: songTitle } : t))
    );
  };

  const toggleMemberExpand = (teamId) => {
    setExpandedMembers({ ...expandedMembers, [teamId]: !expandedMembers[teamId] });
  };

  // ==========================================
  // 工程3: 順序入れ替え
  // ==========================================
  const handleMoveOrder = (groupTeams, index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= groupTeams.length) return;

    const reordered = [...groupTeams];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderMap = new Map();
    reordered.forEach((t, idx) => {
      orderMap.set(t.id, idx + 1);
    });

    setTeams(teams.map((t) => (orderMap.has(t.id) ? { ...t, order: orderMap.get(t.id) } : t)));
  };

  // ==========================================
  // 所要時間計算ヘルパー
  // ==========================================
  const calculateGroupDurationMinutes = (groupTeams) => {
    let totalSeconds = 0;
    groupTeams.forEach((team) => {
      const targetSongTitle = team.selectedSong || team.requestedSong1;
      const matchedSong = songs.find((s) => s.title === targetSongTitle);
      
      let songSec = 180; // デフォルト3分
      if (matchedSong && matchedSong.duration) {
        const parts = matchedSong.duration.split(':');
        if (parts.length === 2) {
          const m = parseInt(parts[0], 10) || 0;
          const s = parseInt(parts[1], 10) || 0;
          songSec = m * 60 + s;
        }
      }
      totalSeconds += songSec;
    });

    return Math.round(totalSeconds / 60);
  };

  const getSongGenre = (title) => {
    const found = songs.find((s) => s.title === title);
    return found?.genre ? `(${found.genre})` : '';
  };

  // ==========================================
  // 一括保存
  // ==========================================
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      await updateDoc(doc(db, 'events', eventId), {
        venueConfigs
      });

      const finalOrderMap = new Map();
      venueConfigs.forEach((v) => {
        v.sections.forEach((secObj) => {
          const secName = secObj.sectionName;
          const group = teams
            .filter((t) => t.venue === v.name && t.section === secName)
            .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));
          group.forEach((t, idx) => {
            finalOrderMap.set(t.id, idx + 1);
          });
        });
      });

      for (const team of teams) {
        const isAssigned = Boolean(team.venue && team.section);
        await updateDoc(doc(db, 'events', eventId, 'teams', team.id), {
          venue: team.venue || '',
          section: team.section || '',
          order: isAssigned ? (finalOrderMap.get(team.id) || '') : '',
          selectedSong: team.selectedSong || team.requestedSong1 || ''
        });
      }

      alert('設定と発表順を保存しました！');
      navigate(`/events/${eventId}`);
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const checkHasUnder18 = (team) => {
    if (team.hasUnder18) return true;
    return Array.isArray(team.members) && team.members.some((m) => m.isUnder18);
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>読み込み中...</div>;
  }

  const unassignedTeams = teams.filter((t) => !t.venue || !t.section);

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(`/events/${eventId}`)} style={styles.backBtn}>
        ← イベント詳細に戻る
      </button>

      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.pageTitle}>会場・部・発表順の設定</h1>
          <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '4px' }}>
            対象イベント: <strong>{eventData?.name}</strong>（全 {teams.length} チーム / 未所属: <span style={{ color: unassignedTeams.length > 0 ? '#dc2626' : '#059669', fontWeight: 'bold' }}>{unassignedTeams.length} チーム</span>）
          </div>
        </div>

        <button onClick={handleSaveAll} disabled={saving} style={styles.saveAllBtn}>
          {saving ? '保存中...' : '💾 すべての設定を保存する'}
        </button>
      </div>

      <div style={styles.tabBar}>
        <button type="button" onClick={() => setActiveTab(1)} style={activeTab === 1 ? styles.tabActive : styles.tab}>
          STEP 1. 会場と部の作成・管理
        </button>
        <button type="button" onClick={() => setActiveTab(2)} style={activeTab === 2 ? styles.tabActive : styles.tab}>
          STEP 2. 会場・部へのチーム振り分け（未所属: {unassignedTeams.length}）
        </button>
        <button type="button" onClick={() => setActiveTab(3)} style={activeTab === 3 ? styles.tabActive : styles.tab}>
          STEP 3. 部ごとの発表順決定 ＆ 所要時間計算
        </button>
      </div>

      {/* =========================================================
          STEP 1: 会場と部の作成・管理
         ========================================================= */}
      {activeTab === 1 && (
        <div style={styles.card}>
          <h2 style={styles.stepTitle}>STEP 1: 会場と部の枠組みを作成</h2>
          <p style={styles.desc}>会場を追加し、それぞれの会場に時間付きの部（セクション）を追加・削除してください。</p>

          <div style={styles.addBox}>
            <input
              type="text"
              value={newVenueName}
              onChange={(e) => setNewVenueName(e.target.value)}
              placeholder="新しい会場名（例: A会場）"
              style={styles.input}
            />
            <button type="button" onClick={handleAddVenue} style={styles.addBtn}>+ 会場を追加</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
            {venueConfigs.length === 0 ? (
              <div style={styles.emptyBox}>会場が登録されていません。</div>
            ) : (
              venueConfigs.map((v) => {
                const currentInput = sectionInputs[v.id] || { sectionName: '', startTime: '', endTime: '' };
                return (
                  <div key={v.id} style={styles.venueConfigCard}>
                    <div style={styles.venueConfigHeader}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a' }}>📍 {v.name}</span>
                      <button type="button" onClick={() => handleRemoveVenue(v.id, v.name)} style={styles.deleteBtn}>会場を削除</button>
                    </div>

                    <div style={styles.sectionsList}>
                      {v.sections.map((sec) => (
                        <div key={sec.sectionName} style={styles.sectionChip}>
                          <span>🔹 {sec.sectionName} ({sec.startTime || '--:--'} ～ {sec.endTime || '--:--'})</span>
                          <button type="button" onClick={() => handleRemoveSection(v.id, v.name, sec.sectionName)} style={styles.chipCloseBtn}>×</button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={currentInput.sectionName}
                        onChange={(e) => setSectionInputs({ ...sectionInputs, [v.id]: { ...currentInput, sectionName: e.target.value } })}
                        placeholder="部名（例: 1部）"
                        style={{ ...styles.input, maxWidth: '140px', padding: '6px 10px' }}
                      />
                      <input
                        type="time"
                        value={currentInput.startTime}
                        onChange={(e) => setSectionInputs({ ...sectionInputs, [v.id]: { ...currentInput, startTime: e.target.value } })}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <span>～</span>
                      <input
                        type="time"
                        value={currentInput.endTime}
                        onChange={(e) => setSectionInputs({ ...sectionInputs, [v.id]: { ...currentInput, endTime: e.target.value } })}
                        style={{ padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <button type="button" onClick={() => handleAddSection(v.id)} style={styles.addSubBtn}>+ 部を追加</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={styles.stepFooter}>
            <button type="button" onClick={() => setActiveTab(2)} style={styles.nextStepBtn}>次へ（STEP 2: チームの振り分け） →</button>
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 2: 横1行テーブル形式 ＆ 各行のセレクトで会場・部を選択
         ========================================================= */}
      {activeTab === 2 && (
        <div style={styles.card}>
          <h2 style={styles.stepTitle}>STEP 2: 会場・部へのチーム振り分け</h2>
          <p style={styles.desc}>
            すべてのチームが「未所属」からスタートします。各チームの横1行にあるプルダウンから「会場・部」を選んで割り当ててください。必要に応じて本番演奏曲の変更やメンバー確認も行えます。
          </p>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>チーム名 / 18歳以下</th>
                  <th style={styles.th}>代表者 / 要望</th>
                  <th style={styles.th}>希望曲 & 本番曲選択</th>
                  <th style={{ ...styles.th, width: '220px' }}>割り当て会場・部</th>
                </tr>
              </thead>
              <tbody>
                {teams.length === 0 ? (
                  <tr><td colSpan="4" style={styles.emptyTd}>エントリーチームがありません。</td></tr>
                ) : (
                  teams.map((team) => {
                    const isU18 = checkHasUnder18(team);
                    const isExpanded = expandedMembers[team.id];
                    const currentVal = team.venue && team.section ? `${team.venue}__${team.section}` : '';

                    return (
                      <tr key={team.id} style={styles.tr}>
                        {/* チーム名 ＆ メンバー開閉 */}
                        <td style={styles.td}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#0f172a' }}>
                            {team.name}
                            {isU18 && <span style={styles.under18Badge}>⚠️ 18歳以下有</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                            人数: {team.memberCount || 0}名義
                            <button type="button" onClick={() => toggleMemberExpand(team.id)} style={styles.toggleMemberBtn}>
                              {isExpanded ? 'メンバー隠す▲' : 'メンバー確認▼'}
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={styles.memberDropdown}>
                              {(team.members || []).map((m, mIdx) => (
                                <div key={mIdx} style={{ fontSize: '0.78rem', color: '#475569' }}>
                                  ・{m.name} ({m.kana || 'ふりがななし'}) {m.isUnder18 ? '[18歳以下]' : ''}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* 代表者・要望 */}
                        <td style={styles.td}>
                          <div style={{ fontWeight: 'bold' }}>{team.leaderName || '-'}</div>
                          {team.remarks && (
                            <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '2px', fontWeight: 'bold' }}>
                              [要望] {team.remarks}
                            </div>
                          )}
                        </td>

                        {/* 希望曲＆本番曲 */}
                        <td style={styles.td}>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '4px' }}>
                            希望: 1: {team.requestedSong1 || '-'} / 2: {team.requestedSong2 || '-'} / 3: {team.requestedSong3 || '-'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#2563eb' }}>本番:</span>
                            <select
                              value={team.selectedSong || team.requestedSong1 || ''}
                              onChange={(e) => handleSelectSong(team.id, e.target.value)}
                              style={{ ...styles.songSelectMini, flex: 1 }}
                            >
                              {team.requestedSong1 && <option value={team.requestedSong1}>第1: {team.requestedSong1}</option>}
                              {team.requestedSong2 && <option value={team.requestedSong2}>第2: {team.requestedSong2}</option>}
                              {team.requestedSong3 && <option value={team.requestedSong3}>第3: {team.requestedSong3}</option>}
                            </select>
                          </div>
                        </td>

                        {/* 会場・部選択プルダウン */}
                        <td style={styles.td}>
                          <select
                            value={currentVal}
                            onChange={(e) => handleTeamVenueSectionChange(team.id, e.target.value)}
                            style={{
                              ...styles.select,
                              borderColor: !currentVal ? '#fca5a5' : '#2563eb',
                              backgroundColor: !currentVal ? '#fef2f2' : '#eff6ff',
                              fontWeight: 'bold',
                              color: !currentVal ? '#dc2626' : '#1e40af'
                            }}
                          >
                            <option value="">-- 未所属（未割り当て） --</option>
                            {venueConfigs.map((v) =>
                              v.sections.map((sec) => (
                                <option key={`${v.name}_${sec.sectionName}`} value={`${v.name}__${sec.sectionName}`}>
                                  📍 {v.name} ＞ 🔹 {sec.sectionName}
                                </option>
                              ))
                            )}
                          </select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={styles.stepFooter}>
            <button type="button" onClick={() => setActiveTab(1)} style={styles.prevStepBtn}>← STEP 1 に戻る</button>
            <button type="button" onClick={() => setActiveTab(3)} style={styles.nextStepBtn}>次へ（STEP 3: 発表順決定） →</button>
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 3: 発表順決定 ＆ 所要時間計算
         ========================================================= */}
      {activeTab === 3 && (
        <div style={styles.card}>
          <h2 style={styles.stepTitle}>STEP 3: 会場・部ごとの発表順決定 ＆ 所要時間確認</h2>
          <p style={styles.desc}>
            各グループの合計所要時間を確認しながら、上下ボタンで発表順を並び替えてください。ここでも本番演奏曲の変更が可能です。
          </p>

          {unassignedTeams.length > 0 && (
            <div style={styles.warningBanner}>
              ⚠️ まだ未所属のチームが <strong>{unassignedTeams.length} チーム</strong> あります。STEP 2 で配置を行ってください。
            </div>
          )}

          {venueConfigs.map((v) => (
            <div key={v.id} style={styles.orderVenueGroup}>
              <h3 style={{ margin: '0 0 12px 0', color: '#0f172a', fontSize: '1.15rem' }}>📍 {v.name}</h3>

              {v.sections.map((secObj) => {
                const secName = secObj.sectionName;
                const groupTeams = teams
                  .filter((t) => t.venue === v.name && t.section === secName)
                  .sort((a, b) => Number(a.order || 999) - Number(b.order || 999));

                const totalMinutes = calculateGroupDurationMinutes(groupTeams);

                return (
                  <div key={secName} style={styles.orderSectionBox}>
                    <div style={styles.orderSectionHeader}>
                      <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>
                        🔹 {v.name} {secName} ({secObj.startTime || '--:--'} ～ {secObj.endTime || '--:--'})
                      </span>
                      <span style={styles.durationBadge}>
                        ⏱️ 合計所要時間: 約 {totalMinutes} 分 （全 {groupTeams.length} チーム）
                      </span>
                    </div>

                    {groupTeams.length === 0 ? (
                      <div style={{ padding: '16px', color: '#94a3b8', fontSize: '0.88rem' }}>
                        この部に所属しているチームはありません。
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                        {groupTeams.map((team, idx) => {
                          const isU18 = checkHasUnder18(team);
                          const isExpanded = expandedMembers[team.id];
                          return (
                            <div key={team.id} style={styles.orderRowCard}>
                              <div style={styles.orderNumberBadge}>{idx + 1}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.98rem', color: '#0f172a' }}>
                                  {team.name}
                                  {isU18 && <span style={styles.under18Badge}>⚠️ 18歳以下有</span>}
                                </div>

                                <div style={{ fontSize: '0.88rem', color: '#334155', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>🎵 本番演奏曲:</span>
                                  <select
                                    value={team.selectedSong || team.requestedSong1 || ''}
                                    onChange={(e) => handleSelectSong(team.id, e.target.value)}
                                    style={{ ...styles.songSelectMini, width: '220px' }}
                                  >
                                    {team.requestedSong1 && <option value={team.requestedSong1}>第1: {team.requestedSong1}</option>}
                                    {team.requestedSong2 && <option value={team.requestedSong2}>第2: {team.requestedSong2}</option>}
                                    {team.requestedSong3 && <option value={team.requestedSong3}>第3: {team.requestedSong3}</option>}
                                  </select>
                                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    {getSongGenre(team.selectedSong || team.requestedSong1)}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '3px' }}>
                                  代表: {team.leaderName || '-'} / 人数: {team.memberCount || 0}名義
                                  <button type="button" onClick={() => toggleMemberExpand(team.id)} style={styles.toggleMemberBtn}>
                                    {isExpanded ? 'メンバー隠す▲' : 'メンバー確認▼'}
                                  </button>
                                  {team.remarks && (
                                    <span style={{ marginLeft: '10px', color: '#b45309', fontWeight: 'bold' }}>
                                      [要望: {team.remarks}]
                                    </span>
                                  )}
                                </div>

                                {isExpanded && (
                                  <div style={styles.memberDropdown}>
                                    {(team.members || []).map((m, mIdx) => (
                                      <span key={mIdx} style={{ fontSize: '0.78rem', marginRight: '10px', color: '#475569' }}>
                                        ・{m.name}{m.isUnder18 ? '(18歳以下)' : ''}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveOrder(groupTeams, idx, 'up')}
                                  style={{ ...styles.moveBtn, opacity: idx === 0 ? 0.35 : 1 }}
                                >
                                  ⬆️ 上へ
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === groupTeams.length - 1}
                                  onClick={() => handleMoveOrder(groupTeams, idx, 'down')}
                                  style={{ ...styles.moveBtn, opacity: idx === groupTeams.length - 1 ? 0.35 : 1 }}
                                >
                                  ⬇️ 下へ
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <div style={styles.stepFooter}>
            <button type="button" onClick={() => setActiveTab(2)} style={styles.prevStepBtn}>← STEP 2 に戻る</button>
            <button type="button" onClick={handleSaveAll} disabled={saving} style={styles.saveAllBtn}>
              {saving ? '保存中...' : '💾 すべての設定を保存する'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '20px 30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' },
  backBtn: { marginBottom: '15px', padding: '6px 14px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', fontSize: '0.85rem', color: '#475569' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' },
  pageTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', margin: 0 },
  saveAllBtn: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontSize: '0.92rem', fontWeight: 'bold', cursor: 'pointer' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  tab: { padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' },
  tabActive: { padding: '10px 18px', borderRadius: '8px', border: '2px solid #f6b179', backgroundColor: '#fff7ed', color: '#9a3412', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' },
  card: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  stepTitle: { fontSize: '1.2rem', margin: '0 0 8px 0', color: '#1e293b' },
  desc: { color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' },
  addBox: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.92rem', flex: '1 1 200px' },
  addBtn: { padding: '8px 18px', borderRadius: '6px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' },
  addSubBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid #2563eb', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' },
  venueConfigCard: { border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', backgroundColor: '#f8fafc' },
  venueConfigHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  deleteBtn: { padding: '4px 10px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' },
  sectionsList: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  sectionChip: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '20px', fontSize: '0.88rem', fontWeight: 'bold', color: '#334155' },
  chipCloseBtn: { border: 'none', background: 'none', color: '#ef4444', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', padding: '0 2px' },
  emptyBox: { padding: '30px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: '8px' },
  tableWrapper: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' },
  th: { backgroundColor: '#f6b179', color: '#1e293b', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 14px', color: '#334155' },
  emptyTd: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  toggleMemberBtn: { marginLeft: '8px', fontSize: '0.75rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 },
  memberDropdown: { marginTop: '6px', padding: '6px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' },
  orderVenueGroup: { border: '2px solid #cbd5e1', borderRadius: '10px', padding: '16px', marginBottom: '20px', backgroundColor: '#fff' },
  select: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.88rem' },
  songSelectMini: { padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.82rem', backgroundColor: '#fff' },
  under18Badge: { display: 'inline-block', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.72rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' },
  warningBanner: { padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.9rem', marginBottom: '16px' },
  orderSectionBox: { border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', backgroundColor: '#f8fafc', marginTop: '12px' },
  orderSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' },
  durationBadge: { backgroundColor: '#e0e7ff', color: '#1e40af', padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' },
  orderRowCard: { display: 'flex', alignItems: 'center', gap: '14px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
  orderNumberBadge: { width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#f6b179', color: '#1e293b', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 },
  moveBtn: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' },
  stepFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' },
  nextStepBtn: { marginLeft: 'auto', padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#f6b179', color: '#1e293b', fontWeight: 'bold', fontSize: '0.92rem', cursor: 'pointer' },
  prevStepBtn: { padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontSize: '0.9rem', cursor: 'pointer' }
};

export default EventOrderPage;