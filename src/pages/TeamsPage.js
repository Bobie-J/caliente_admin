import React, { useState, useEffect } from 'react';
import { db, storage } from '../config/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const MAX_MEMBERS_LIMIT = 15; // チームメンバーの最大数

const createEmptyMember = () => ({
  name: '',
  kana: '',
  memberNo: '',
  isUnder18: false,
  documentFile: null,
  documentUrl: '',
  documentName: ''
});

const TeamsPage = () => {
  const [instructors, setInstructors] = useState([]);
  const [teamList, setTeamList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 一覧画面の横断検索キーワード
  const [listSearchKeyword, setListSearchKeyword] = useState('');

  // --- 新規登録フロー (Step 0: 一覧, 1: 代表者＆チーム基本情報, 2: メンバー登録, 3: プロフィール入力) ---
  const [regStep, setRegStep] = useState(0);
  const [selectedLid, setSelectedLid] = useState('');
  const [instructorSearchKeyword, setInstructorSearchKeyword] = useState('');

  // チーム基本情報 ＆ メンバー ＆ プロフィール
  const [teamName, setTeamName] = useState('');
  const [teamKana, setTeamKana] = useState('');
  const [members, setMembers] = useState([createEmptyMember()]);
  const [profileText, setProfileText] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // --- 既存チーム編集モーダル用ステート ---
  const [editingTeam, setEditingTeam] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      // 1. 代表者取得
      const instSnap = await getDocs(collection(db, 'instructors'));
      const instList = instSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setInstructors(instList);

      // 2. 各代表者LID配下のチームプール (instructors/{lid}/teams) を集約
      const allTeams = [];
      for (const inst of instList) {
        const lid = inst.lid || inst.id;
        const tSnap = await getDocs(collection(db, 'instructors', lid, 'teams'));
        tSnap.docs.forEach((tDoc) => {
          allTeams.push({
            id: tDoc.id,
            leaderLid: lid,
            leaderName: inst.name || '',
            leaderKana: inst.kana || '',
            ...tDoc.data()
          });
        });
      }
      setTeamList(allTeams);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleStartRegister = () => {
    setSelectedLid('');
    setInstructorSearchKeyword('');
    setTeamName('');
    setTeamKana('');
    setMembers([createEmptyMember()]);
    setProfileText('');
    setRegStep(1);
  };

  // Step 1 ➔ Step 2 (メンバー入力へ)
  const handleStep1Next = (e) => {
    e.preventDefault();
    if (!selectedLid) return alert('代表者を選択してください。');
    if (!teamName.trim()) return alert('チーム名を入力してください。');
    setRegStep(2);
  };

  // Step 2 ➔ Step 3 (プロフィール入力へ)
  const handleStep2Next = (e) => {
    e.preventDefault();
    if (members.length === 0 || members.length > MAX_MEMBERS_LIMIT) {
      return alert(`メンバー数は 1名 〜 ${MAX_MEMBERS_LIMIT}名 の間で登録してください。`);
    }

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.name.trim()) return alert(`${i + 1}人目のメンバー名を入力してください。`);
      if (m.isUnder18 && !m.documentFile && !m.documentUrl) {
        return alert(`${i + 1}人目（${m.name}）は18歳以下にチェックが入っているため、証明書類をアップロードしてください。`);
      }
    }
    setRegStep(3);
  };

  const handleAddMemberRow = () => {
    if (members.length >= MAX_MEMBERS_LIMIT) {
      return alert(`メンバーの最大数は ${MAX_MEMBERS_LIMIT} 名までです。`);
    }
    setMembers([...members, createEmptyMember()]);
  };

  const handleRemoveMemberRow = (index) => {
    if (members.length <= 1) {
      return alert('最低1名のメンバー登録が必要です。');
    }
    setMembers(members.filter((_, idx) => idx !== index));
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

  const uploadProofDocument = async (file, lid) => {
    const safeName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `under18_proofs/${lid}/${safeName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const url = await getDownloadURL(snapshot.ref);
    return { url, fileName: file.name };
  };

  // 最終登録実行 (代表者チームプールへのテンプレート保存)
  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (profileText.length > 150) {
      return alert('チームプロフィールは150文字以内で入力してください。');
    }

    try {
      setSubmitting(true);
      const today = new Date().toISOString().split('T')[0];

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

      // 代表者のチームプールへ保存 (instructors/{lid}/teams)
      const poolTeamData = {
        name: teamName.trim(),
        kana: teamKana.trim(),
        leaderLid: selectedLid,
        members: formattedMembers,
        memberCount: formattedMembers.length,
        profileText: profileText.trim(),
        createdAt: today,
        updatedAt: today
      };
      await addDoc(collection(db, 'instructors', selectedLid, 'teams'), poolTeamData);

      alert('チームテンプレートを登録しました！');
      setRegStep(0);
      fetchAllData();
    } catch (error) {
      console.error('チームテンプレート登録エラー:', error);
      alert('登録に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  // --- 既存チーム編集用 ---
  const handleOpenEditModal = (team) => {
    setEditingTeam({
      ...team,
      members: (team.members || []).map((m) => ({ ...m, documentFile: null }))
    });
  };

  const handleEditMemberChange = (index, field, value) => {
    const updated = [...editingTeam.members];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'isUnder18' && !value) {
      updated[index].documentFile = null;
      updated[index].documentUrl = '';
      updated[index].documentName = '';
    }
    setEditingTeam({ ...editingTeam, members: updated });
  };

  const handleAddEditMember = () => {
    if (editingTeam.members.length >= MAX_MEMBERS_LIMIT) {
      return alert(`メンバーの最大数は ${MAX_MEMBERS_LIMIT} 名までです。`);
    }
    setEditingTeam({
      ...editingTeam,
      members: [...editingTeam.members, createEmptyMember()]
    });
  };

  const handleRemoveEditMember = (index) => {
    if (editingTeam.members.length <= 1) return alert('最低1名のメンバーが必要です。');
    setEditingTeam({
      ...editingTeam,
      members: editingTeam.members.filter((_, idx) => idx !== index)
    });
  };

  const handleSaveEditedTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam.name.trim()) return alert('チーム名を入力してください。');
    if ((editingTeam.profileText || '').length > 150) {
      return alert('プロフィールは150文字以内で入力してください。');
    }
    
    for (let i = 0; i < editingTeam.members.length; i++) {
      const m = editingTeam.members[i];
      if (!m.name.trim()) return alert(`${i + 1}人目のメンバー名を入力してください。`);
      if (m.isUnder18 && !m.documentFile && !m.documentUrl) {
        return alert(`${i + 1}人目（${m.name}）は18歳以下ですが、証明書類が未登録です。アップロードしてください。`);
      }
    }

    try {
      setSavingEdit(true);
      const formattedMembers = [];
      for (const m of editingTeam.members) {
        let docUrl = m.documentUrl || '';
        let docName = m.documentName || '';
        if (m.isUnder18 && m.documentFile) {
          const uploaded = await uploadProofDocument(m.documentFile, editingTeam.leaderLid);
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

      const today = new Date().toISOString().split('T')[0];
      const teamDocRef = doc(db, 'instructors', editingTeam.leaderLid, 'teams', editingTeam.id);
      await updateDoc(teamDocRef, {
        name: editingTeam.name.trim(),
        kana: (editingTeam.kana || '').trim(),
        members: formattedMembers,
        memberCount: formattedMembers.length,
        profileText: (editingTeam.profileText || '').trim(),
        updatedAt: today
      });

      setEditingTeam(null);
      fetchAllData();
      alert('チームテンプレートを更新しました！');
    } catch (error) {
      console.error('更新エラー:', error);
      alert('更新に失敗しました。');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    if (!window.confirm(`「${team.name}」を削除してもよろしいですか？`)) return;
    try {
      await deleteDoc(doc(db, 'instructors', team.leaderLid, 'teams', team.id));
      setEditingTeam(null);
      fetchAllData();
    } catch (error) {
      console.error('削除エラー:', error);
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

  const displayedTeams = teamList.filter((team) => {
    const kw = listSearchKeyword.trim().toLowerCase();
    if (!kw) return true;
    const matchLeader =
      (team.leaderLid || '').toLowerCase().includes(kw) ||
      (team.leaderName || '').toLowerCase().includes(kw) ||
      (team.leaderKana || '').toLowerCase().includes(kw);
    const matchTeam =
      (team.name || '').toLowerCase().includes(kw) ||
      (team.kana || '').toLowerCase().includes(kw);
    const matchMember = (team.members || []).some(
      (m) => (m.name || '').toLowerCase().includes(kw) || (m.kana || '').toLowerCase().includes(kw)
    );
    return matchLeader || matchTeam || matchMember;
  });

  const selectedInstructorObj = instructors.find((i) => (i.lid || i.id) === selectedLid);

  return (
    <div style={styles.container}>
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>チームテンプレート管理</h1>
        {regStep === 0 && (
          <button onClick={handleStartRegister} style={styles.primaryBtn}>
            + 新規チーム登録
          </button>
        )}
      </div>

      {/* STEP 1: 代表者選択 ＆ チーム基本情報 */}
      {regStep === 1 && (
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <span style={styles.stepBadge}>STEP 1 / 3</span>
            <h2 style={styles.cardTitle}>代表者・チーム名の選択</h2>
          </div>

          <form onSubmit={handleStep1Next} style={styles.form}>
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
                  style={styles.select}
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

            <div style={styles.rowInputs}>
              <label style={{ ...styles.label, flex: 1 }}>
                チーム名 <span style={styles.required}>*</span>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="例: Caliente Stars"
                  required
                  style={styles.input}
                />
              </label>
              <label style={{ ...styles.label, flex: 1 }}>
                チーム名ふりがな
                <input
                  type="text"
                  value={teamKana}
                  onChange={(e) => setTeamKana(e.target.value)}
                  placeholder="例: かりえんてすたーず"
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.footerActions}>
              <button type="button" onClick={() => setRegStep(0)} style={styles.cancelBtn}>
                キャンセル
              </button>
              <button type="submit" style={styles.primaryBtn}>
                次へ（メンバー情報入力） →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: メンバー情報入力 */}
      {regStep === 2 && (
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <span style={styles.stepBadge}>STEP 2 / 3</span>
            <h2 style={styles.cardTitle}>メンバー情報入力（最大15名）</h2>
          </div>

          <div style={styles.summaryBanner}>
            <div><strong>代表者:</strong> {selectedLid} / {selectedInstructorObj?.name}</div>
            <div><strong>チーム名:</strong> {teamName}</div>
            <div><strong>メンバー数:</strong> {members.length} / {MAX_MEMBERS_LIMIT}名</div>
          </div>

          <form onSubmit={handleStep2Next} style={styles.form}>
            <div style={styles.memberSectionHeader}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>メンバーリスト</h3>
              <button
                type="button"
                onClick={handleAddMemberRow}
                disabled={members.length >= MAX_MEMBERS_LIMIT}
                style={{ ...styles.addMemberBtn, opacity: members.length >= MAX_MEMBERS_LIMIT ? 0.5 : 1 }}
              >
                + メンバーを追加
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {members.map((member, idx) => (
                <div key={idx} style={styles.memberCard}>
                  <div style={styles.memberCardTop}>
                    <span style={styles.memberIndexBadge}>メンバー {idx + 1}</span>
                    {members.length > 1 && (
                      <button type="button" onClick={() => handleRemoveMemberRow(idx)} style={styles.removeRowBtn}>
                        削除
                      </button>
                    )}
                  </div>

                  <div style={styles.memberGrid}>
                    <label style={styles.label}>
                      メンバー名 <span style={styles.required}>*</span>
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                        placeholder="例: 鈴木 一郎"
                        required
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      フリガナ
                      <input
                        type="text"
                        value={member.kana}
                        onChange={(e) => handleMemberChange(idx, 'kana', e.target.value)}
                        placeholder="例: スズキ イチロウ"
                        style={styles.input}
                      />
                    </label>
                    <label style={styles.label}>
                      会員No
                      <input
                        type="text"
                        value={member.memberNo}
                        onChange={(e) => handleMemberChange(idx, 'memberNo', e.target.value)}
                        placeholder="例: M-12345"
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div style={styles.under18Row}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={member.isUnder18}
                        onChange={(e) => handleMemberChange(idx, 'isUnder18', e.target.checked)}
                      />
                      18歳以下（年齢証明・保護者同意書が必要）
                    </label>

                    {member.isUnder18 && (
                      <div style={styles.uploadBox}>
                        <label style={styles.uploadLabel}>
                          証明書類をアップロード <span style={styles.required}>*</span>:
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => handleMemberChange(idx, 'documentFile', e.target.files[0] || null)}
                            style={{ marginLeft: '8px' }}
                          />
                        </label>
                        {member.documentFile && (
                          <span style={styles.fileSelectedText}>選択中: {member.documentFile.name}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.footerActions}>
              <button type="button" onClick={() => setRegStep(1)} style={styles.cancelBtn}>
                ← 戻る
              </button>
              <button type="submit" style={styles.primaryBtn}>
                次へ（プロフィール入力） →
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: チームプロフィール入力 */}
      {regStep === 3 && (
        <div style={styles.card}>
          <div style={styles.stepHeader}>
            <span style={styles.stepBadge}>STEP 3 / 3</span>
            <h2 style={styles.cardTitle}>チームプロフィール入力</h2>
          </div>
          <p style={styles.desc}>
            チーム紹介や意気込みなどをテンプレートとして入力してください（最大150文字）。
          </p>

          <form onSubmit={handleFinalSubmit} style={styles.form}>
            <label style={styles.label}>
              チームプロフィール（任意 / 最大150文字）
              <textarea
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                maxLength={150}
                rows={4}
                placeholder="例: 私たちは地域の仲間で結成したチームです。最高のパフォーマンスをお届けします！"
                style={styles.textarea}
              />
              <div style={{ textAlign: 'right', fontSize: '0.82rem', color: profileText.length > 150 ? '#ef4444' : '#64748b' }}>
                {profileText.length} / 150 文字
              </div>
            </label>

            <div style={styles.footerActions}>
              <button type="button" onClick={() => setRegStep(2)} style={styles.cancelBtn}>
                ← 戻る
              </button>
              <button type="submit" disabled={submitting} style={styles.submitBtn}>
                {submitting ? '登録処理中...' : 'チームテンプレート登録を完了する'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 0: 登録済みチーム一覧表示 */}
      {regStep === 0 && (
        <div style={styles.card}>
          <div style={styles.filterBar}>
            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
              登録済みテンプレート数: {displayedTeams.length} チーム（全 {teamList.length} チーム中）
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal', marginLeft: '10px' }}>
                （行をクリックすると編集・詳細確認ができます）
              </span>
            </div>

            <div style={styles.searchInputWrapper}>
              <input
                type="text"
                value={listSearchKeyword}
                onChange={(e) => setListSearchKeyword(e.target.value)}
                placeholder="代表者・チーム名・メンバー名で検索..."
                style={styles.listSearchInput}
              />
              {listSearchKeyword && (
                <button type="button" onClick={() => setListSearchKeyword('')} style={styles.clearSearchBtn}>
                  クリア
                </button>
              )}
            </div>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>代表者LID</th>
                  <th style={styles.th}>代表者名</th>
                  <th style={styles.th}>チーム名</th>
                  <th style={styles.th}>メンバー数</th>
                  <th style={styles.th}>メンバー一覧</th>
                  <th style={styles.th}>プロフィール</th>
                  <th style={styles.th}>更新日</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={styles.emptyTd}>読み込み中...</td></tr>
                ) : displayedTeams.length === 0 ? (
                  <tr><td colSpan="7" style={styles.emptyTd}>登録されているチームテンプレートはありません。</td></tr>
                ) : (
                  displayedTeams.map((team) => (
                    <tr key={`${team.leaderLid}_${team.id}`} onClick={() => handleOpenEditModal(team)} style={styles.clickableRow}>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{team.leaderLid}</td>
                      <td style={styles.td}>{team.leaderName || '-'}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{team.name}</td>
                      <td style={styles.tdCenter}>{team.members?.length ?? team.memberCount ?? 0} 名</td>
                      <td style={styles.td}>
                        {(team.members || []).map((m) => m.name).join('、') || '-'}
                      </td>
                      <td style={styles.td} title={team.profileText}>
                        {team.profileText ? (team.profileText.length > 25 ? team.profileText.slice(0, 25) + '...' : team.profileText) : '-'}
                      </td>
                      <td style={styles.td}>{team.updatedAt || team.createdAt || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 既存チーム編集モーダル */}
      {editingTeam && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContentLarge}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>
                チームテンプレート編集（{editingTeam.leaderLid} : {editingTeam.leaderName}）
              </h2>
              <button type="button" onClick={() => handleDeleteTeam(editingTeam)} style={styles.deleteTeamBtn}>
                チームを削除
              </button>
            </div>

            <form onSubmit={handleSaveEditedTeam} style={styles.form}>
              <div style={styles.rowInputs}>
                <label style={{ ...styles.label, flex: 1 }}>
                  チーム名 <span style={styles.required}>*</span>
                  <input
                    type="text"
                    value={editingTeam.name}
                    onChange={(e) => setEditingTeam({ ...editingTeam, name: e.target.value })}
                    required
                    style={styles.input}
                  />
                </label>
                <label style={{ ...styles.label, flex: 1 }}>
                  ふりがな
                  <input
                    type="text"
                    value={editingTeam.kana || ''}
                    onChange={(e) => setEditingTeam({ ...editingTeam, kana: e.target.value })}
                    style={styles.input}
                  />
                </label>
              </div>

              <label style={styles.label}>
                チームプロフィール（最大150文字）
                <textarea
                  value={editingTeam.profileText || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, profileText: e.target.value })}
                  maxLength={150}
                  rows={3}
                  style={styles.textarea}
                />
              </label>

              <div style={styles.memberSectionHeader}>
                <h4 style={{ margin: 0 }}>メンバーリスト（{editingTeam.members.length} 名）</h4>
                <button type="button" onClick={handleAddEditMember} style={styles.addMemberBtn}>
                  + メンバーを追加
                </button>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {editingTeam.members.map((m, idx) => (
                  <div key={idx} style={styles.memberCard}>
                    <div style={styles.memberCardTop}>
                      <span style={styles.memberIndexBadge}>メンバー {idx + 1}</span>
                      <button type="button" onClick={() => handleRemoveEditMember(idx)} style={styles.removeRowBtn}>
                        削除
                      </button>
                    </div>
                    
                    <div style={styles.memberGrid}>
                      <label style={styles.label}>
                        名前 *
                        <input
                          type="text"
                          value={m.name}
                          onChange={(e) => handleEditMemberChange(idx, 'name', e.target.value)}
                          required
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.label}>
                        フリガナ
                        <input
                          type="text"
                          value={m.kana || ''}
                          onChange={(e) => handleEditMemberChange(idx, 'kana', e.target.value)}
                          style={styles.input}
                        />
                      </label>
                      <label style={styles.label}>
                        会員No
                        <input
                          type="text"
                          value={m.memberNo || ''}
                          onChange={(e) => handleEditMemberChange(idx, 'memberNo', e.target.value)}
                          style={styles.input}
                        />
                      </label>
                    </div>

                    {/* 18歳以下 ＆ ファイルアップロード (編集用) */}
                    <div style={styles.under18Row}>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={m.isUnder18 || false}
                          onChange={(e) => handleEditMemberChange(idx, 'isUnder18', e.target.checked)}
                        />
                        18歳以下（年齢証明・保護者同意書が必要）
                      </label>

                      {m.isUnder18 && (
                        <div style={styles.uploadBox}>
                          <label style={styles.uploadLabel}>
                            証明書類をアップロード {m.documentUrl ? '（新しいファイルで上書き）' : <span style={styles.required}>*</span>}:
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => handleEditMemberChange(idx, 'documentFile', e.target.files[0] || null)}
                              style={{ marginLeft: '8px' }}
                            />
                          </label>
                          
                          {/* 選択状況・登録状況の表示 */}
                          {m.documentFile ? (
                            <span style={styles.fileSelectedText}>選択中: {m.documentFile.name}</span>
                          ) : m.documentUrl ? (
                            <span style={{ ...styles.fileSelectedText, color: '#0f172a' }}>
                              登録済み: {m.documentName || 'ファイルあり'} 
                              <a href={m.documentUrl} target="_blank" rel="noreferrer" style={{ marginLeft: '12px', color: '#2563eb', textDecoration: 'underline' }}>
                                別タブで確認
                              </a>
                            </span>
                          ) : (
                            <span style={{ ...styles.fileSelectedText, color: '#ef4444' }}>未登録（アップロードが必要です）</span>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>

              <div style={styles.footerActions}>
                <button type="button" onClick={() => setEditingTeam(null)} style={styles.cancelBtn}>
                  キャンセル
                </button>
                <button type="submit" disabled={savingEdit} style={styles.submitBtn}>
                  {savingEdit ? '保存中...' : '変更を保存'}
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
  container: { padding: '20px 30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', margin: 0 },
  card: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  stepHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  stepBadge: { backgroundColor: '#f6b179', color: '#1e293b', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold' },
  cardTitle: { fontSize: '1.25rem', margin: 0, color: '#1e293b' },
  desc: { color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  label: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', fontWeight: 'bold', color: '#334155' },
  required: { color: '#ef4444' },
  input: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 'normal' },
  textarea: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontFamily: 'sans-serif' },
  select: { padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.95rem', backgroundColor: '#fff' },
  searchSelectBox: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' },
  summaryBanner: { display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '12px 16px', backgroundColor: '#f1f5f9', borderRadius: '8px', fontSize: '0.9rem', color: '#1e293b', marginBottom: '18px' },
  rowInputs: { display: 'flex', gap: '14px', flexWrap: 'wrap' },
  memberSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0' },
  addMemberBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid #2563eb', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 'bold', fontSize: '0.85rem', cursor: 'pointer' },
  memberCard: { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 16px' },
  memberCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  memberIndexBadge: { fontSize: '0.82rem', fontWeight: 'bold', color: '#475569', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' },
  removeRowBtn: { padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.78rem', cursor: 'pointer' },
  memberGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  under18Row: { marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 'bold', color: '#334155', cursor: 'pointer' },
  uploadBox: { marginTop: '8px', padding: '10px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' },
  uploadLabel: { fontSize: '0.85rem', color: '#334155', fontWeight: 'bold' },
  fileSelectedText: { display: 'block', marginTop: '6px', fontSize: '0.82rem', color: '#059669', fontWeight: 'bold' },
  footerActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' },
  primaryBtn: { backgroundColor: '#f6b179', color: '#1e293b', border: 'none', padding: '10px 22px', borderRadius: '8px', fontSize: '0.92rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.08)' },
  submitBtn: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontSize: '0.92rem', fontWeight: 'bold', cursor: 'pointer' },
  cancelBtn: { backgroundColor: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 18px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer' },
  deleteTeamBtn: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '6px 12px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 'bold', cursor: 'pointer' },
  filterBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' },
  searchInputWrapper: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 340px', maxWidth: '460px' },
  listSearchInput: { width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' },
  clearSearchBtn: { padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.82rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  tableWrapper: { width: '100%', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' },
  th: { backgroundColor: '#f6b179', color: '#1e293b', padding: '12px 14px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  clickableRow: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer' },
  td: { padding: '14px', color: '#334155', whiteSpace: 'nowrap' },
  tdCenter: { padding: '14px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap' },
  emptyTd: { padding: '40px', textAlign: 'center', color: '#94a3b8' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContentLarge: { background: '#ffffff', padding: '28px', borderRadius: '12px', width: '760px', maxWidth: '94%', maxHeight: '90vh', overflowY: 'auto' }
};

export default TeamsPage;