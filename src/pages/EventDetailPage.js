import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../config/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県', 'その他'
];

const createEmptyMember = () => ({
  name: '',
  kana: '',
  memberNo: '',
  isUnder18: false,
  documentFile: null,
  documentUrl: '',
  documentName: ''
});

const EventDetailPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [eventData, setEventData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  // イベント編集モーダル（新規作成と同じフル項目に拡張）
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '', prefecture: '東京都', location: '', isPublic: true,
    eventDate: '', startTime: '', endTime: '', registerStart: '', registerEnd: '',
    minMembers: 1, maxMembers: 9
  });

  // 管理者によるチーム追加モーダル関連
  const [isAddTeamModalOpen, setIsAddTeamModalOpen] = useState(false);
  const [instructors, setInstructors] = useState([]);
  const [songs, setSongs] = useState([]);
  const [instructorTemplates, setInstructorTemplates] = useState([]);

  // 追加フォームの状態
  const [selectedLid, setSelectedLid] = useState('');
  const [instructorSearchKeyword, setInstructorSearchKeyword] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  
  const [teamName, setTeamName] = useState('');
  const [teamKana, setTeamKana] = useState('');
  const [members, setMembers] = useState([createEmptyMember()]);
  const [profileText, setProfileText] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  // 楽曲検索用キーワード（第1〜第3希望それぞれ）
  const [songSearch1, setSongSearch1] = useState('');
  const [songSearch2, setSongSearch2] = useState('');
  const [songSearch3, setSongSearch3] = useState('');

  // 希望曲 ＆ 要望
  const [requestedSong1, setRequestedSong1] = useState('');
  const [requestedSong2, setRequestedSong2] = useState('');
  const [requestedSong3, setRequestedSong3] = useState('');
  const [remarks, setRemarks] = useState('');

  const [submittingTeam, setSubmittingTeam] = useState(false);

  const fetchEventAndTeams = async () => {
    try {
      setLoading(true);

      const eventDocRef = doc(db, 'events', eventId);
      const eventSnap = await getDoc(eventDocRef);

      if (eventSnap.exists()) {
        setEventData({ id: eventSnap.id, ...eventSnap.data() });
      }

      const teamsRef = collection(db, 'events', eventId, 'teams');
      const teamsSnap = await getDocs(teamsRef);
      const teamList = teamsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      setTeams(teamList);

      const instSnap = await getDocs(collection(db, 'instructors'));
      setInstructors(instSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const songSnap = await getDocs(collection(db, 'songs'));
      setSongs(songSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEventAndTeams();
  }, [eventId]);

  useEffect(() => {
    if (!selectedLid) {
      setInstructorTemplates([]);
      return;
    }
    const fetchTemplates = async () => {
      try {
        const tSnap = await getDocs(collection(db, 'instructors', selectedLid, 'teams'));
        setInstructorTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('テンプレート取得エラー:', err);
      }
    };
    fetchTemplates();
  }, [selectedLid]);

  const handleSelectTemplate = (e) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId);
    if (!tId) {
      setTeamName('');
      setTeamKana('');
      setMembers([createEmptyMember()]);
      setProfileText('');
      return;
    }
    const targetT = instructorTemplates.find(t => t.id === tId);
    if (targetT) {
      setTeamName(targetT.name || '');
      setTeamKana(targetT.kana || '');
      setMembers(targetT.members && targetT.members.length > 0 ? targetT.members : [createEmptyMember()]);
      setProfileText(targetT.profileText || '');
    }
  };

  const handleMemberChange = (index, field, value) => {
    const updated = [...members];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'isUnder18' && !value) {
      updated[index].documentFile = null;
      updated[index].documentUrl = '';
      updated[index].documentName = '';
    }
    setMembers(updated);
  };

  const handleAddMemberRow = () => {
    if (members.length >= 15) return alert('メンバーは最大15名までです。');
    setMembers([...members, createEmptyMember()]);
  };

  const handleRemoveMemberRow = (index) => {
    if (members.length <= 1) return alert('最低1名のメンバーが必要です。');
    setMembers(members.filter((_, idx) => idx !== index));
  };

  const uploadProofDocument = async (file, lid) => {
    const safeName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `under18_proofs/${lid}/${safeName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, fileName: file.name };
  };

  const handleOpenEditModal = () => {
    if (eventData) {
      setEditFormData({
        name: eventData.name || '',
        prefecture: eventData.prefecture || '東京都',
        location: eventData.location || '',
        isPublic: eventData.isPublic ?? true,
        eventDate: eventData.eventDate || '',
        startTime: eventData.startTime || '',
        endTime: eventData.endTime || '',
        registerStart: eventData.registerStart || '',
        registerEnd: eventData.registerEnd || '',
        minMembers: eventData.minMembers ?? 1,
        maxMembers: eventData.maxMembers ?? 9
      });
      setIsEditModalOpen(true);
    }
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    if (!editFormData.name) return alert('カリエンテ名を入力してください');

    try {
      const eventDocRef = doc(db, 'events', eventId);
      await updateDoc(eventDocRef, editFormData);
      setIsEditModalOpen(false);
      fetchEventAndTeams();
      alert('開催内容を更新しました！');
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました。');
    }
  };

  const handleOpenAddTeamModal = () => {
    setSelectedLid('');
    setInstructorSearchKeyword('');
    setSelectedTemplateId('');
    setTeamName('');
    setTeamKana('');
    setMembers([createEmptyMember()]);
    setProfileText('');
    setSaveAsTemplate(false);
    setRequestedSong1('');
    setRequestedSong2('');
    setRequestedSong3('');
    setSongSearch1('');
    setSongSearch2('');
    setSongSearch3('');
    setRemarks('');
    setIsAddTeamModalOpen(true);
  };

  const handleAdminAddTeam = async (e) => {
    e.preventDefault();
    if (!selectedLid) return alert('代表者を選択してください。');
    if (!teamName.trim()) return alert('チーム名を入力してください。');
    if (!requestedSong1 || !requestedSong2 || !requestedSong3) {
      return alert('第1希望〜第3希望の楽曲をすべて選択してください。');
    }
    if (requestedSong1 === requestedSong2 || requestedSong1 === requestedSong3 || requestedSong2 === requestedSong3) {
      return alert('同じ曲を重複して選択することはできません。');
    }

    try {
      setSubmittingTeam(true);
      const today = new Date().toISOString().split('T')[0];
      const leaderObj = instructors.find(i => (i.lid || i.id) === selectedLid);

      const formattedMembers = [];
      for (const m of members) {
        let docUrl = m.documentUrl || '';
        let docName = m.documentName || '';
        if (m.isUnder18 && m.documentFile) {
          const uploaded = await uploadProofDocument(m.documentFile, selectedLid);
          docUrl = uploaded.url;
          docName = uploaded.fileName;
        }
        formattedMembers.push({
          name: m.name.trim(),
          kana: (m.kana || '').trim(),
          memberNo: (m.memberNo || '').trim(),
          isUnder18: Boolean(m.isUnder18),
          documentUrl: docUrl,
          documentName: docName
        });
      }

      const hasUnder18 = formattedMembers.some(m => m.isUnder18);

      const teamPayload = {
        name: teamName.trim(),
        kana: teamKana.trim(),
        leaderLid: selectedLid,
        leaderName: leaderObj?.name || '',
        members: formattedMembers,
        memberCount: formattedMembers.length,
        hasUnder18,
        requestedSong1,
        requestedSong2,
        requestedSong3,
        profileText: profileText.trim(),
        remarks: remarks.trim(),
        venue: '', section: '', order: '',
        createdAt: today,
        updatedAt: today,
        timestamp: serverTimestamp()
      };

      await addDoc(collection(db, 'events', eventId, 'teams'), teamPayload);
      await updateDoc(doc(db, 'events', eventId), {
        teamCount: increment(1)
      });

      if (saveAsTemplate) {
        await addDoc(collection(db, 'instructors', selectedLid, 'teams'), {
          name: teamName.trim(),
          kana: teamKana.trim(),
          leaderLid: selectedLid,
          members: formattedMembers,
          memberCount: formattedMembers.length,
          profileText: profileText.trim(),
          createdAt: today,
          updatedAt: today
        });
      }

      alert('チームをイベントにエントリーしました！');
      setIsAddTeamModalOpen(false);
      fetchEventAndTeams();
    } catch (error) {
      console.error('チーム追加エラー:', error);
      alert('チームの追加に失敗しました。');
    } finally {
      setSubmittingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId, teamNameStr) => {
    if (!window.confirm(`チーム「${teamNameStr}」のエントリーを削除してもよろしいですか？`)) return;

    try {
      await deleteDoc(doc(db, 'events', eventId, 'teams', teamId));
      await updateDoc(doc(db, 'events', eventId), {
        teamCount: increment(-1)
      });
      alert('エントリーを削除しました。');
      fetchEventAndTeams();
    } catch (error) {
      console.error('チーム削除エラー:', error);
      alert('削除に失敗しました。');
    }
  };

  const filteredInstructors = instructors.filter((inst) => {
    const lid = (inst.lid || inst.id).toLowerCase();
    const name = (inst.name || '').toLowerCase();
    const kana = (inst.kana || '').toLowerCase();
    const kw = instructorSearchKeyword.toLowerCase();
    return lid.includes(kw) || name.includes(kw) || kana.includes(kw);
  });

  const filterSongsByKeyword = (keyword) => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return songs;
    return songs.filter(s =>
      (s.title || '').toLowerCase().includes(kw) ||
      (s.discNo || '').toLowerCase().includes(kw) ||
      (s.genre || '').toLowerCase().includes(kw) ||
      (s.zinOrMm || '').toLowerCase().includes(kw)
    );
  };

  if (loading) {
    return <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>データを読み込んでいます...</div>;
  }

  if (!eventData) {
    return <div style={{ padding: '30px', textAlign: 'center', color: '#ef4444' }}>イベント情報が存在しません。</div>;
  }

  return (
    <div style={styles.container}>
      <button onClick={() => navigate('/events')} style={styles.backBtn}>
        ← イベント一覧に戻る
      </button>

      {/* --- ヘッダー領域 --- */}
      <div style={styles.headerRow}>
        <div style={styles.titleBlock}>
          <h1 style={styles.eventTitle}>{eventData.name || '無題のイベント'}</h1>
          <div style={styles.locationText}>
            @{eventData.prefecture || ''} {eventData.location || '会場未設定'}
          </div>
        </div>

        <div style={styles.metaBlock}>
          <span style={styles.metaLabel}>開催日:</span>
          <span style={styles.metaValue}>{eventData.eventDate || '未定'}</span>
        </div>

        <div style={styles.metaBlock}>
          <span style={styles.metaLabel}>時間:</span>
          <span style={styles.metaValue}>
            {eventData.startTime || '00:00'} ～ {eventData.endTime || '00:00'}
          </span>
        </div>

        <button onClick={handleOpenEditModal} style={styles.editBtn}>
          開催内容を変更
        </button>
      </div>

      {/* --- エントリー一覧カード --- */}
      <div style={styles.card}>
        <div style={styles.cardHeaderRow}>
          <div style={styles.entryCountHeader}>
            <strong>現在のエントリー数:</strong> {teams.length} チーム
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleOpenAddTeamModal}
              style={styles.addTeamBtn}
            >
              + チームを追加
            </button>
            <button
              onClick={() => navigate(`/events/${eventId}/order`)}
              style={styles.orderSettingBtn}
            >
              会場・部・発表順を決める
            </button>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: '18%' }}>チーム名</th>
                <th style={{ ...styles.th, width: '14%' }}>代表者名</th>
                <th style={{ ...styles.th, width: '7%' }}>人数</th>
                <th style={{ ...styles.th, width: '16%' }}>希望曲 (1/2/3)</th>
                <th style={{ ...styles.th, width: '14%' }}>要望・備考</th>
                <th style={{ ...styles.th, width: '7%' }}>会場 / 部</th>
                <th style={{ ...styles.th, width: '6%' }}>発表順</th>
                <th style={{ ...styles.th, width: '8%' }}>登録日</th>
                <th style={{ ...styles.th, width: '6%' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 ? (
                <tr>
                  <td colSpan="9" style={styles.emptyTd}>
                    現在登録されているエントリーチームはありません。
                  </td>
                </tr>
              ) : (
                teams.map((team) => (
                  <tr key={team.id} style={styles.tr}>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>
                      {team.name}
                      {team.hasUnder18 && (
                        <span style={styles.under18Badge} title="18歳以下のメンバーが在籍しています">
                          ⚠️ 18歳以下有
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>{team.leaderName || '-'}</td>
                    <td style={styles.tdCenter}>{team.memberCount || 0}</td>
                    <td style={styles.td}>
                      1: {team.requestedSong1 || '-'}<br />
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        2: {team.requestedSong2 || '-'} / 3: {team.requestedSong3 || '-'}
                      </span>
                    </td>
                    <td style={styles.td}>{team.remarks || '-'}</td>
                    <td style={styles.tdCenter}>
                      {team.venue || '-'} / {team.section || '-'}
                    </td>
                    <td style={styles.tdCenter}>{team.order || '-'}</td>
                    <td style={styles.td}>{team.createdAt || '-'}</td>
                    <td style={styles.tdCenter}>
                      <button
                        onClick={() => handleDeleteTeam(team.id, team.name)}
                        style={styles.deleteTeamBtn}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- チーム追加モーダル --- */}
      {isAddTeamModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentLarge}>
            <h2 style={{ marginTop: 0, marginBottom: '15px' }}>管理者によるチームエントリー追加</h2>
            <form onSubmit={handleAdminAddTeam} style={styles.form}>
              
              <div style={styles.searchSelectBox}>
                <label style={styles.label}>
                  代表者検索（LID・名前・フリガナ）:
                  <input
                    type="text"
                    value={instructorSearchKeyword}
                    onChange={(e) => setInstructorSearchKeyword(e.target.value)}
                    placeholder="例: L001 または 山田"
                    style={styles.input}
                  />
                </label>

                <label style={styles.label}>
                  代表者を選択 <span style={styles.required}>*</span>
                  <select
                    value={selectedLid}
                    onChange={(e) => setSelectedLid(e.target.value)}
                    required
                    style={styles.input}
                  >
                    <option value="">-- 代表者を選択してください --</option>
                    {filteredInstructors.map((inst) => {
                      const lid = inst.lid || inst.id;
                      return (
                        <option key={lid} value={lid}>
                          [{lid}] {inst.name}（{inst.kana || 'ふりがななし'}）
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>

              {selectedLid && (
                <label style={styles.label}>
                  登録済みチームテンプレートを呼び出す:
                  <select
                    value={selectedTemplateId}
                    onChange={handleSelectTemplate}
                    style={styles.input}
                  >
                    <option value="">-- テンプレートを使わず新規入力する --</option>
                    {instructorTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}（メンバー {t.members?.length || 0}名）
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div style={styles.rowInputs}>
                <label style={{ ...styles.label, flex: 1 }}>
                  チーム名 <span style={styles.required}>*</span>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    required
                    style={styles.input}
                  />
                </label>
                <label style={{ ...styles.label, flex: 1 }}>
                  ふりがな
                  <input
                    type="text"
                    value={teamKana}
                    onChange={(e) => setTeamKana(e.target.value)}
                    style={styles.input}
                  />
                </label>
              </div>

              {/* メンバー編集セクション */}
              <div style={styles.memberSectionHeader}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>
                  メンバー情報（最大15名）
                </h3>
                <button
                  type="button"
                  onClick={handleAddMemberRow}
                  style={styles.addMemberBtnSmall}
                >
                  + メンバー追加
                </button>
              </div>

              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {members.map((m, idx) => (
                  <div key={idx} style={styles.memberCardMini}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#475569' }}>メンバー {idx + 1}</span>
                      {members.length > 1 && (
                        <button type="button" onClick={() => handleRemoveMemberRow(idx)} style={styles.removeRowBtn}>
                          削除
                        </button>
                      )}
                    </div>
                    <div style={styles.rowInputs}>
                      <input
                        type="text"
                        value={m.name}
                        onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                        placeholder="氏名 *"
                        required
                        style={{ ...styles.input, flex: 2 }}
                      />
                      <input
                        type="text"
                        value={m.kana}
                        onChange={(e) => handleMemberChange(idx, 'kana', e.target.value)}
                        placeholder="フリガナ"
                        style={{ ...styles.input, flex: 2 }}
                      />
                      <input
                        type="text"
                        value={m.memberNo}
                        onChange={(e) => handleMemberChange(idx, 'memberNo', e.target.value)}
                        placeholder="会員No"
                        style={{ ...styles.input, flex: 1 }}
                      />
                    </div>
                    <div style={{ marginTop: '4px' }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="checkbox"
                          checked={m.isUnder18}
                          onChange={(e) => handleMemberChange(idx, 'isUnder18', e.target.checked)}
                        />
                        18歳以下
                      </label>
                      {m.isUnder18 && (
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleMemberChange(idx, 'documentFile', e.target.files[0] || null)}
                          style={{ fontSize: '0.8rem', marginTop: '4px' }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <label style={styles.label}>
                チームプロフィール（最大150文字）
                <textarea
                  value={profileText}
                  onChange={(e) => setProfileText(e.target.value)}
                  maxLength={150}
                  rows={2}
                  style={styles.textarea}
                />
              </label>

              {!selectedTemplateId && selectedLid && (
                <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={saveAsTemplate}
                    onChange={(e) => setSaveAsTemplate(e.target.checked)}
                  />
                  この内容を新たなチームテンプレートとしても保存する
                </label>
              )}

              <hr style={{ border: '0', borderTop: '1px solid #e2e8f0', margin: '10px 0' }} />

              <h3 style={{ fontSize: '1rem', margin: '0 0 5px 0', color: '#1e293b' }}>希望曲の選択（すべて必須・検索可能）</h3>
              
              {/* 第1希望曲 */}
              <div style={styles.songSelectGroup}>
                <label style={styles.label}>第1希望曲 <span style={styles.required}>*</span></label>
                <input
                  type="text"
                  value={songSearch1}
                  onChange={(e) => setSongSearch1(e.target.value)}
                  placeholder="曲名・DiscNo・ジャンルで検索して絞り込み..."
                  style={{ ...styles.input, marginBottom: '4px', fontSize: '0.85rem' }}
                />
                <select value={requestedSong1} onChange={(e) => setRequestedSong1(e.target.value)} required style={styles.input}>
                  <option value="">-- 曲を選択してください --</option>
                  {filterSongsByKeyword(songSearch1).map(s => (
                    <option key={s.id} value={s.title}>
                      [{s.zinOrMm} Disc.{s.discNo}] {s.title}（{s.genre || '-'}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 第2希望曲 */}
              <div style={styles.songSelectGroup}>
                <label style={styles.label}>第2希望曲 <span style={styles.required}>*</span></label>
                <input
                  type="text"
                  value={songSearch2}
                  onChange={(e) => setSongSearch2(e.target.value)}
                  placeholder="曲名・DiscNo・ジャンルで検索して絞り込み..."
                  style={{ ...styles.input, marginBottom: '4px', fontSize: '0.85rem' }}
                />
                <select value={requestedSong2} onChange={(e) => setRequestedSong2(e.target.value)} required style={styles.input}>
                  <option value="">-- 曲を選択してください --</option>
                  {filterSongsByKeyword(songSearch2).map(s => (
                    <option key={s.id} value={s.title}>
                      [{s.zinOrMm} Disc.{s.discNo}] {s.title}（{s.genre || '-'}）
                    </option>
                  ))}
                </select>
              </div>

              {/* 第3希望曲 */}
              <div style={styles.songSelectGroup}>
                <label style={styles.label}>第3希望曲 <span style={styles.required}>*</span></label>
                <input
                  type="text"
                  value={songSearch3}
                  onChange={(e) => setSongSearch3(e.target.value)}
                  placeholder="曲名・DiscNo・ジャンルで検索して絞り込み..."
                  style={{ ...styles.input, marginBottom: '4px', fontSize: '0.85rem' }}
                />
                <select value={requestedSong3} onChange={(e) => setRequestedSong3(e.target.value)} required style={styles.input}>
                  <option value="">-- 曲を選択してください --</option>
                  {filterSongsByKeyword(songSearch3).map(s => (
                    <option key={s.id} value={s.title}>
                      [{s.zinOrMm} Disc.{s.discNo}] {s.title}（{s.genre || '-'}）
                    </option>
                  ))}
                </select>
              </div>

              <label style={styles.label}>
                要望・備考（例: 午後は予定あり、〇〇チームと代表者が同じ 等）:
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="特記事項があれば入力してください"
                  style={styles.textarea}
                />
              </label>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setIsAddTeamModalOpen(false)} style={styles.cancelBtn}>キャンセル</button>
                <button type="submit" disabled={submittingTeam} style={styles.submitBtn}>
                  {submittingTeam ? '登録中...' : 'チームをエントリーする'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- イベント編集モーダル（新規作成と同じフル項目に拡張） --- */}
      {isEditModalOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h2 style={{ marginTop: 0, marginBottom: '15px' }}>開催内容の変更</h2>
            <form onSubmit={handleUpdateEvent} style={styles.form}>
              <label style={styles.label}>
                カリエンテ名:
                <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} required style={styles.input} />
              </label>

              <div style={styles.rowInputs}>
                <label style={styles.label}>
                  都道府県:
                  <select name="prefecture" value={editFormData.prefecture} onChange={handleEditChange} style={styles.input}>
                    {PREFECTURES.map((pref) => <option key={pref} value={pref}>{pref}</option>)}
                  </select>
                </label>
                <label style={{ ...styles.label, flex: 2 }}>
                  会場:
                  <input type="text" name="location" value={editFormData.location} onChange={handleEditChange} placeholder="例: パシフィコ横浜" style={styles.input} />
                </label>
              </div>

              <label style={{ ...styles.label, flexDirection: 'row', alignItems: 'center' }}>
                <input type="checkbox" name="isPublic" checked={editFormData.isPublic} onChange={handleEditChange} />
                表ページに公開する
              </label>

              <div style={styles.rowInputs}>
                <label style={styles.label}>開催日: <input type="date" name="eventDate" value={editFormData.eventDate} onChange={handleEditChange} style={styles.input} /></label>
                <label style={styles.label}>開始: <input type="time" name="startTime" value={editFormData.startTime} onChange={handleEditChange} style={styles.input} /></label>
                <label style={styles.label}>終了: <input type="time" name="endTime" value={editFormData.endTime} onChange={handleEditChange} style={styles.input} /></label>
              </div>

              <div style={styles.rowInputs}>
                <label style={styles.label}>登録開始日: <input type="date" name="registerStart" value={editFormData.registerStart} onChange={handleEditChange} style={styles.input} /></label>
                <label style={styles.label}>登録終了日: <input type="date" name="registerEnd" value={editFormData.registerEnd} onChange={handleEditChange} style={styles.input} /></label>
              </div>

              <div style={styles.rowInputs}>
                <label style={styles.label}>
                  メンバー下限数:
                  <input type="number" name="minMembers" value={editFormData.minMembers} onChange={handleEditChange} min="1" style={styles.input} />
                </label>
                <label style={styles.label}>
                  メンバー上限数:
                  <input type="number" name="maxMembers" value={editFormData.maxMembers} onChange={handleEditChange} min="1" style={styles.input} />
                </label>
              </div>

              <div style={styles.modalActions}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} style={styles.cancelBtn}>キャンセル</button>
                <button type="submit" style={styles.submitBtn}>変更を保存</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: { padding: '20px 30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' },
  backBtn: { marginBottom: '15px', padding: '6px 14px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', fontSize: '0.85rem', color: '#475569' },
  headerRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '20px' },
  titleBlock: { display: 'flex', flexDirection: 'column' },
  eventTitle: { fontSize: '1.8rem', fontWeight: 'bold', color: '#0f172a', margin: 0 },
  locationText: { fontSize: '0.95rem', color: '#475569', marginTop: '2px' },
  metaBlock: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' },
  metaLabel: { fontWeight: 'bold', color: '#0f172a' },
  metaValue: { color: '#334155' },
  editBtn: { marginLeft: 'auto', backgroundColor: '#f28b82', color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '20px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' },
  card: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  cardHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  entryCountHeader: { fontSize: '1.05rem', color: '#1e293b' },
  addTeamBtn: { backgroundColor: '#10b981', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' },
  orderSettingBtn: { backgroundColor: '#ffb74d', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' },
  tableWrapper: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' },
  th: { backgroundColor: '#f6b179', color: '#1e293b', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '14px', color: '#334155' },
  tdCenter: { padding: '14px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap' },
  emptyTd: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  deleteTeamBtn: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '4px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 'bold' },
  under18Badge: { display: 'inline-block', backgroundColor: '#fef3c7', color: '#b45309', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: '#ffffff', padding: '30px', borderRadius: '12px', width: '520px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' },
  modalContentLarge: { background: '#ffffff', padding: '30px', borderRadius: '12px', width: '700px', maxWidth: '94%', maxHeight: '90vh', overflowY: 'auto' },
  form: { display: 'flex', flexDirection: 'column', gap: '12px' },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.88rem', fontWeight: 'bold', color: '#334155' },
  required: { color: '#ef4444' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'normal' },
  textarea: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'sans-serif' },
  searchSelectBox: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' },
  rowInputs: { display: 'flex', gap: '10px' },
  memberSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' },
  addMemberBtnSmall: { padding: '4px 10px', backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' },
  memberCardMini: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px' },
  removeRowBtn: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', fontSize: '0.75rem', padding: '2px 6px', cursor: 'pointer' },
  songSelectGroup: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '6px' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '15px' },
  cancelBtn: { padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' },
  submitBtn: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }
};

export default EventDetailPage;