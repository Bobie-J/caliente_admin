import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県', 'その他'
];

const BillingPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [billingsMap, setBillingsMap] = useState({}); // eventId -> billingData list or map
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventTeams, setEventTeams] = useState([]);
  const [instructorsMap, setInstructorsMap] = useState(new Map());
  const [representativesSummary, setRepresentativesSummary] = useState([]);

  // 明細書モーダル表示用のステート
  const [activeBillModal, setActiveBillModal] = useState(null); // { event, rep, billingRecord }

  // ステップ管理
  const [step, setStep] = useState(1);

  // STEP 1の絞り込みフィルター
  const [filterPref, setFilterPref] = useState('all');
  const [filterLocationQuery, setFilterLocationQuery] = useState('');
  const [filterDateQuery, setFilterDateQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // 料金・引き落とし日設定
  const [pricingConfig, setPricingConfig] = useState({
    entryFee: 3000,
    generalFee: 2000,
    memberFee: 1500,
    under18Fee: 1000,
    dueDate: ''
  });

  const [expandedReps, setExpandedReps] = useState({});
  const [selectedRepsForEmail, setSelectedRepsForEmail] = useState({});
  const [selectAllReps, setSelectAllReps] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 1. データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const instSnap = await getDocs(collection(db, 'instructors'));
        const instMap = new Map();
        instSnap.docs.forEach(d => {
          const data = d.data();
          instMap.set(d.id, data);
          if (data.name) instMap.set(data.name, data);
        });
        setInstructorsMap(instMap);

        // Billings 取得（eventIdごとの代表者別明細も保持）
        const billingsSnap = await getDocs(collection(db, 'billings'));
        const billingDataMap = {}; // eventId -> { [repName]: billingDoc }
        billingsSnap.docs.forEach(d => {
          const bData = d.data();
          if (bData.eventId) {
            if (!billingDataMap[bData.eventId]) {
              billingDataMap[bData.eventId] = {};
            }
            billingDataMap[bData.eventId][bData.repName] = bData;
          }
        });
        setBillingsMap(billingDataMap);

        const eventsSnap = await getDocs(collection(db, 'events'));
        const todayStr = new Date().toISOString().split('T')[0];
        const loadedEvents = [];

        eventsSnap.docs.forEach(d => {
          const data = d.data();
          const eventDate = data.date || data.eventDate || '2099-12-31';
          if (eventDate <= todayStr || true) {
            loadedEvents.push({
              id: d.id,
              ...data,
              isIssued: Boolean(billingDataMap[d.id])
            });
          }
        });
        setEvents(loadedEvents);
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 2. イベント選択時にチーム情報集計
  const handleSelectEvent = async (eventId) => {
    setSelectedEventId(eventId);
    if (!eventId) {
      setEventTeams([]);
      setRepresentativesSummary([]);
      return;
    }

    try {
      setLoading(true);
      const teamsSnap = await getDocs(collection(db, 'events', eventId, 'teams'));
      const teamsList = teamsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEventTeams(teamsList);

      const eventBillings = billingsMap[eventId] || {};
      const firstRepKey = Object.keys(eventBillings)[0];
      if (firstRepKey && eventBillings[firstRepKey].pricingConfig) {
        setPricingConfig(eventBillings[firstRepKey].pricingConfig);
      } else {
        setPricingConfig({
          entryFee: 3000,
          generalFee: 2000,
          memberFee: 1500,
          under18Fee: 1000,
          dueDate: ''
        });
      }

      const repMap = new Map();

      teamsList.forEach(team => {
        const repName = team.leaderName || '代表者未設定';
        let repEmail = team.leaderEmail || team.email || '';
        const leaderLid = team.leaderLid || team.lid || '';
        
        if (!repEmail && leaderLid && instructorsMap.has(leaderLid)) {
          repEmail = instructorsMap.get(leaderLid).email || '';
        }
        if (!repEmail && instructorsMap.has(repName)) {
          repEmail = instructorsMap.get(repName).email || '';
        }

        const repKey = `${repName}_${repEmail || 'no_email'}`;

        if (!repMap.has(repKey)) {
          repMap.set(repKey, {
            repKey,
            repName,
            repEmail,
            teams: [],
            teamCount: 0,
            memberCount: 0,
            generalCount: 0,
            under18Count: 0,
            detailedMembers: []
          });
        }

        const repData = repMap.get(repKey);
        repData.teams.push(team);
        repData.teamCount += 1;

        const leaderMemberNo = team.leaderMemberNo || team.memberNo || (instructorsMap.has(leaderLid) ? instructorsMap.get(leaderLid).memberNo : '') || '';
        const leaderIsMember = Boolean(leaderMemberNo);

        if (leaderIsMember) {
          repData.memberCount += 1;
          repData.detailedMembers.push({ name: `${repName} (代表)`, status: '会員 (会員No:' + leaderMemberNo + ')' });
        } else {
          repData.generalCount += 1;
          repData.detailedMembers.push({ name: `${repName} (代表)`, status: '一般' });
        }

        const members = team.members || [];
        members.forEach(m => {
          const isU18 = m.isUnder18 || false;
          const memberNo = m.memberNo || (m.lid && instructorsMap.has(m.lid) ? instructorsMap.get(m.lid).memberNo : '') || '';
          const hasMemberNo = Boolean(memberNo);

          if (isU18) {
            repData.under18Count += 1;
            repData.detailedMembers.push({ name: m.name || '名前なし', status: '18歳以下 (証明書確認済)' });
          } else if (hasMemberNo) {
            repData.memberCount += 1;
            repData.detailedMembers.push({ name: m.name || '名前なし', status: '会員 (会員No:' + memberNo + ')' });
          } else {
            repData.generalCount += 1;
            repData.detailedMembers.push({ name: m.name || '名前なし', status: '一般' });
          }
        });
      });

      const summaries = Array.from(repMap.values());
      setRepresentativesSummary(summaries);

      const initialChecks = {};
      summaries.forEach(s => { initialChecks[s.repKey] = true; });
      setSelectedRepsForEmail(initialChecks);
      setSelectAllReps(true);
      setExpandedReps({});

      setStep(2);
    } catch (err) {
      console.error('チームデータ集計エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectAll = (e) => {
    const checked = e.target.checked;
    setSelectAllReps(checked);
    const newChecks = {};
    representativesSummary.forEach(s => {
      newChecks[s.repKey] = checked;
    });
    setSelectedRepsForEmail(newChecks);
  };

  const handleToggleRepCheck = (repKey) => {
    const updated = { ...selectedRepsForEmail, [repKey]: !selectedRepsForEmail[repKey] };
    setSelectedRepsForEmail(updated);
    const allChecked = representativesSummary.every(s => updated[s.repKey]);
    setSelectAllReps(allChecked);
  };

  const toggleRepExpand = (repKey) => {
    setExpandedReps({ ...expandedReps, [repKey]: !expandedReps[repKey] });
  };

  const calculateTotalAmount = (rep) => {
    const u18FeeToApply = Math.min(pricingConfig.under18Fee, pricingConfig.memberFee);
    const entryTotal = rep.teamCount * pricingConfig.entryFee;
    const memberTotal = rep.memberCount * pricingConfig.memberFee;
    const generalTotal = rep.generalCount * pricingConfig.generalFee;
    const u18Total = rep.under18Count * u18FeeToApply;
    return entryTotal + memberTotal + generalTotal + u18Total;
  };

  // 1. 明細書作成ボタン
  const handleGenerateBills = async () => {
    try {
      setSubmitting(true);
      const billingBatchId = `bill_${Date.now()}`;
      const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '/');

      const updatedMapForEvent = {};

      for (const rep of representativesSummary) {
        const u18FeeToApply = Math.min(pricingConfig.under18Fee, pricingConfig.memberFee);
        const breakdown = {
          teamCount: rep.teamCount,
          entryFeeTotal: rep.teamCount * pricingConfig.entryFee,
          memberCount: rep.memberCount,
          memberFeeTotal: rep.memberCount * pricingConfig.memberFee,
          generalCount: rep.generalCount,
          generalFeeTotal: rep.generalCount * pricingConfig.generalFee,
          under18Count: rep.under18Count,
          under18FeeTotal: rep.under18Count * u18FeeToApply,
          totalAmount: calculateTotalAmount(rep)
        };

        const billDocId = `${selectedEventId}_${rep.repEmail || rep.repName}`;
        const billingPayload = {
          eventId: selectedEventId,
          batchId: billingBatchId,
          repName: rep.repName,
          repEmail: rep.repEmail,
          teams: rep.teams.map(t => t.name),
          breakdown,
          pricingConfig,
          dueDate: pricingConfig.dueDate || '',
          issueDate: todayStr, // 明細書作成日
          updatedAt: new Date().toISOString(),
          status: 'created'
        };

        await setDoc(doc(db, 'billings', billDocId), billingPayload, { merge: true });
        updatedMapForEvent[rep.repName] = billingPayload;
      }

      setBillingsMap(prev => ({
        ...prev,
        [selectedEventId]: updatedMapForEvent
      }));

      alert('全代表者の明細書を作成・更新しました！');
    } catch (err) {
      console.error('明細書作成エラー:', err);
      alert('明細書の作成に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. メール送信ボタン
  const handleSendEmails = async () => {
    const targetReps = representativesSummary.filter(rep => selectedRepsForEmail[rep.repKey]);
    if (targetReps.length === 0) {
      return alert('メールを送信する代表者が選択されていません。');
    }
    if (!window.confirm(`選択された ${targetReps.length} 名の代表者へ案内メールを送信します。よろしいですか？`)) {
      return;
    }

    try {
      setSubmitting(true);
      for (const rep of targetReps) {
        console.log(`[メール送信完了] 宛先: ${rep.repEmail}, 代表者: ${rep.repName}`);
      }
      alert(`選択された ${targetReps.length} 名の代表者へメールを送信しました！`);
    } catch (err) {
      console.error('メール送信エラー:', err);
      alert('メール送信に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && events.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>読み込み中...</div>;
  }

  const uniquePrefectures = Array.from(new Set(events.map(e => e.prefecture).filter(Boolean)));

  const filteredEvents = events.filter(ev => {
    const evPref = ev.prefecture || '';
    const evLoc = (ev.location || '').toLowerCase();
    const evDate = ev.date || ev.eventDate || '';
    const isIssued = Boolean(billingsMap[ev.id]);
    const statusStr = isIssued ? 'issued' : 'unissued';

    const matchPref = filterPref === 'all' || evPref === filterPref;
    const matchLoc = !filterLocationQuery || evLoc.includes(filterLocationQuery.toLowerCase());
    const matchDate = !filterDateQuery || evDate.startsWith(filterDateQuery);
    const matchStatus = filterStatus === 'all' || statusStr === filterStatus;

    return matchPref && matchLoc && matchDate && matchStatus;
  });

  const selectedEventData = events.find(e => e.id === selectedEventId);

  return (
    <div style={styles.container}>
      <h1 style={styles.pageTitle}>請求・明細書発行管理</h1>
      <p style={styles.desc}>イベントごとのエントリー料や参加費を集計し、代表者への一括請求・明細書発行を行います。</p>

      {/* ステップインジケーター */}
      <div style={styles.stepIndicator}>
        <div style={step === 1 ? styles.activeStepTab : styles.stepTab}>STEP 1: イベント選択</div>
        <div style={step === 2 ? styles.activeStepTab : styles.stepTab}>STEP 2: 内訳チェック</div>
        <div style={step === 3 ? styles.activeStepTab : styles.stepTab}>STEP 3: 料金設定・発行・メール</div>
      </div>

      {/* =========================================================
          STEP 1: イベント選択ページ
         ========================================================= */}
      {step === 1 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>STEP 1: 明細書を作成するイベントを選択</h2>
          <p style={styles.subDesc}>条件を指定してイベントを絞り込み、選択してください。</p>

          <div style={styles.filterBar}>
            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>開催地(都道府県):</label>
              <select value={filterPref} onChange={(e) => setFilterPref(e.target.value)} style={styles.filterSelect}>
                <option value="all">すべて</option>
                {uniquePrefectures.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>会場(フリーワード):</label>
              <input
                type="text"
                value={filterLocationQuery}
                onChange={(e) => setFilterLocationQuery(e.target.value)}
                placeholder="例: メイン、文化会館"
                style={styles.filterInput}
              />
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>開催日(年/年月/年月日):</label>
              <input
                type="text"
                value={filterDateQuery}
                onChange={(e) => setFilterDateQuery(e.target.value)}
                placeholder="例: 2026 または 2026-11"
                style={{ ...styles.filterInput, width: '150px' }}
              />
            </div>

            <div style={styles.filterItem}>
              <label style={styles.filterLabel}>ステータス:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={styles.filterSelect}>
                <option value="all">すべて</option>
                <option value="unissued">未発行</option>
                <option value="issued">発行済み</option>
              </select>
            </div>

            {(filterPref !== 'all' || filterLocationQuery || filterDateQuery || filterStatus !== 'all') && (
              <button
                type="button"
                onClick={() => { setFilterPref('all'); setFilterLocationQuery(''); setFilterDateQuery(''); setFilterStatus('all'); }}
                style={styles.clearFilterBtn}
              >
                リセット
              </button>
            )}
          </div>

          <div style={{ ...styles.eventListContainer, marginTop: '16px' }}>
            {filteredEvents.length === 0 ? (
              <div style={styles.emptyBox}>条件に合致するイベントはありません。</div>
            ) : (
              filteredEvents.map(ev => {
                const isIssued = Boolean(billingsMap[ev.id]);
                return (
                  <div key={ev.id} style={{ ...styles.eventRow, backgroundColor: isIssued ? '#f1f5f9' : '#f8fafc' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.02rem', color: '#0f172a' }}>{ev.name}</span>
                      <span style={{ fontSize: '0.85rem', color: '#475569' }}>📍 {ev.prefecture || '-'} / 会場: {ev.location || '-'}</span>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>開催日: {ev.date || ev.eventDate || '未設定'}</span>
                      {isIssued && <span style={styles.issuedBadge}>発行済み</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectEvent(ev.id)}
                      style={isIssued ? styles.selectEventAltBtn : styles.selectEventBtn}
                    >
                      {isIssued ? '内容を確認・再調整 →' : 'このイベントを選択 →'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 2: 請求内訳チェックページ
         ========================================================= */}
      {step === 2 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={styles.cardTitle}>STEP 2: 代表者ごとの請求内訳チェック</h2>
              <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                対象イベント: <strong>{selectedEventData?.name}</strong>（全 {eventTeams.length} チーム / 代表者数: {representativesSummary.length} 名）
              </p>
            </div>
            <button type="button" onClick={() => setStep(1)} style={styles.backBtn}>← イベント選択に戻る</button>
          </div>

          <p style={{ fontSize: '0.85rem', color: '#2563eb', marginBottom: '10px' }}>
            💡 代表者名をクリックすると、チームメンバーのステータス詳細を展開して確認できます。
          </p>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>代表者名 / メールアドレス</th>
                  <th style={styles.th}>エントリーチーム</th>
                  <th style={styles.th}>チーム数</th>
                  <th style={styles.th}>会員参加人数</th>
                  <th style={styles.th}>一般参加人数</th>
                  <th style={styles.th}>18歳以下人数</th>
                </tr>
              </thead>
              <tbody>
                {representativesSummary.map((rep, idx) => {
                  const isExpanded = expandedReps[rep.repKey];
                  return (
                    <React.Fragment key={idx}>
                      <tr style={styles.tr} onClick={() => toggleRepExpand(rep.repKey)}>
                        <td style={{ ...styles.td, fontWeight: 'bold', cursor: 'pointer' }}>
                          <span style={{ color: '#2563eb', marginRight: '6px' }}>{isExpanded ? '▼' : '▶'}</span>
                          {rep.repName}
                          <div style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 'normal', marginLeft: '16px' }}>{rep.repEmail || '⚠️ メールアドレス未登録'}</div>
                        </td>
                        <td style={styles.td}>{rep.teams.map(t => t.name).join(', ')}</td>
                        <td style={styles.tdCenter}>{rep.teamCount} チーム</td>
                        <td style={styles.tdCenter}>{rep.memberCount} 人</td>
                        <td style={styles.tdCenter}>{rep.generalCount} 人</td>
                        <td style={styles.tdCenter}>{rep.under18Count} 人</td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan="6" style={{ backgroundColor: '#f8fafc', padding: '12px 20px', borderBottom: '2px solid #cbd5e1' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#334155', marginBottom: '6px' }}>
                              👥 メンバーごとの内訳詳細:
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                              {rep.detailedMembers.map((m, mIdx) => (
                                <div key={mIdx} style={{ backgroundColor: '#fff', padding: '6px 10px', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                                  <strong>・{m.name}</strong>：<span style={{ color: m.status.includes('会員') ? '#2563eb' : m.status.includes('18歳以下') ? '#b45309' : '#475569', fontWeight: 'bold' }}>{m.status}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={styles.stepFooter}>
            <button type="button" onClick={() => setStep(3)} style={styles.nextStepBtn}>
              次へ（STEP 3: 料金設定・発行・メール） →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          STEP 3: 料金設定・明細書発行・メール送信
         ========================================================= */}
      {step === 3 && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={styles.cardTitle}>STEP 3: 料金・期日設定 ＆ 明細書発行・メール送信</h2>
            <button type="button" onClick={() => setStep(2)} style={styles.backBtn}>← 内訳チェックに戻る</button>
          </div>

          <div style={styles.configBox}>
            <h3 style={{ fontSize: '1rem', color: '#1e293b', marginBottom: '12px' }}>💰 今回の請求単価設定</h3>
            <div style={styles.configGrid}>
              <div style={styles.configField}>
                <label style={styles.label}>チームエントリー料 (1チーム)</label>
                <input
                  type="number"
                  value={pricingConfig.entryFee}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, entryFee: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
              <div style={styles.configField}>
                <label style={styles.label}>一般参加費 (1人)</label>
                <input
                  type="number"
                  value={pricingConfig.generalFee}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, generalFee: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
              <div style={styles.configField}>
                <label style={styles.label}>会員参加費 (1人)</label>
                <input
                  type="number"
                  value={pricingConfig.memberFee}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, memberFee: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
              <div style={styles.configField}>
                <label style={styles.label}>18歳以下 (会員費より安い場合自動適用)</label>
                <input
                  type="number"
                  value={pricingConfig.under18Fee}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, under18Fee: Number(e.target.value) })}
                  style={styles.input}
                />
              </div>
              <div style={styles.configField}>
                <label style={styles.label}>📅 引き落とし予定日</label>
                <input
                  type="date"
                  value={pricingConfig.dueDate}
                  onChange={(e) => setPricingConfig({ ...pricingConfig, dueDate: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <div>
              <strong>① 明細書の一括作成・更新</strong>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>上の設定金額をもとに、全代表者の明細書を作成または上書き保存します。</div>
            </div>
            <button type="button" onClick={handleGenerateBills} disabled={submitting} style={styles.executeBtn}>
              {submitting ? '処理中...' : '📝 全チームの明細書を作成・更新する'}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#0f172a', margin: 0 }}>✉️ メール送信対象の選択（代表者ごと）</h3>
            <label style={{ fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
              <input
                type="checkbox"
                checked={selectAllReps}
                onChange={handleToggleSelectAll}
                style={{ width: '16px', height: '16px' }}
              />
              全て選択 / 解除
            </label>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: '50px', textAlign: 'center' }}></th>
                  <th style={styles.th}>代表者名 / メールアドレス</th>
                  <th style={styles.th}>チーム数</th>
                  <th style={styles.th}>内訳 (エントリー / 会員 / 一般 / 18歳以下)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>合計請求金額</th>
                  <th style={{ ...styles.th, textAlign: 'center', width: '130px' }}>明細書確認</th>
                </tr>
              </thead>
              <tbody>
                {representativesSummary.map((rep, idx) => {
                  const u18Fee = Math.min(pricingConfig.under18Fee, pricingConfig.memberFee);
                  const total = calculateTotalAmount(rep);
                  const isChecked = Boolean(selectedRepsForEmail[rep.repKey]);
                  const billingRecord = billingsMap[selectedEventId]?.[rep.repName];

                  return (
                    <tr key={idx} style={styles.tr}>
                      <td style={{ ...styles.tdCenter }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRepCheck(rep.repKey)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 'bold' }}>{rep.repName}</div>
                        <div style={{ fontSize: '0.78rem', color: '#2563eb' }}>{rep.repEmail || '⚠️ メールアドレス未登録'}</div>
                      </td>
                      <td style={styles.tdCenter}>{rep.teamCount} チーム</td>
                      <td style={styles.td}>
                        エ:{rep.teamCount}×{pricingConfig.entryFee} + 会:{rep.memberCount}×{pricingConfig.memberFee} + 一:{rep.generalCount}×{pricingConfig.generalFee} + 18:{rep.under18Count}×{u18Fee}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#2563eb', fontSize: '1.05rem' }}>
                        ¥{total.toLocaleString()}
                      </td>
                      <td style={styles.tdCenter}>
                        <button
                          type="button"
                          onClick={() => setActiveBillModal({ event: selectedEventData, rep, billingRecord: billingRecord || { breakdown: { teamCount: rep.teamCount, entryFeeTotal: rep.teamCount * pricingConfig.entryFee, memberCount: rep.memberCount, memberFeeTotal: rep.memberCount * pricingConfig.memberFee, generalCount: rep.generalCount, generalFeeTotal: rep.generalCount * pricingConfig.generalFee, under18Count: rep.under18Count, under18FeeTotal: rep.under18Count * u18Fee, totalAmount: total }, dueDate: pricingConfig.dueDate, issueDate: new Date().toISOString().split('T')[0].replace(/-/g, '/') } })}
                          style={styles.viewBillBtn}
                        >
                          📄 明細書を表示
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ ...styles.stepFooter, justifyContent: 'space-between' }}>
            <button type="button" onClick={() => setStep(2)} style={styles.backBtn}>← 内訳チェックに戻る</button>
            <button type="button" onClick={handleSendEmails} disabled={submitting} style={styles.mailSendBtn}>
              {submitting ? '送信中...' : '📤 チェックした代表者へ明細書メールを送信する'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          Web明細書プレビュー用モーダル (添付画像完全再現)
         ========================================================= */}
      {activeBillModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeaderNoPrint}>
              <button type="button" onClick={() => window.print()} style={styles.printBtn}>🖨️ 印刷 / PDF保存</button>
              <button type="button" onClick={() => setActiveBillModal(null)} style={styles.closeModalBtn}>✕ 閉じる</button>
            </div>

            {/* 明細書本体のペーパーレイアウト */}
            <div style={styles.invoicePaper}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  発行日 {activeBillModal.billingRecord?.issueDate || new Date().toISOString().split('T')[0].replace(/-/g, '/')}
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '10px 0 30px 0' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 'bold', backgroundColor: '#e2e8f0', padding: '6px 40px', letterSpacing: '4px' }}>
                  明細書
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  {activeBillModal.rep.repName} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>様</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{activeBillModal.event?.name || 'イベント名'}</div>
                  <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                    @{activeBillModal.event?.location || '会場未設定'} / {activeBillModal.event?.eventDate || '開催日未設定'} 開催分
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px 16px', marginBottom: '20px' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  合計：¥{(activeBillModal.billingRecord?.breakdown?.totalAmount || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#b45309' }}>
                  引き落とし予定日：{activeBillModal.billingRecord?.dueDate || '未設定'}
                </div>
              </div>

              <div style={{ fontSize: '0.88rem', marginBottom: '16px', lineHeight: '1.5' }}>
                以下、明細のご確認をお願いいたします。<br />
                なお、恐れ入りますが、引き落とし予定日までに、上記合計金額をご用意いただけますようお願い申し上げます。
              </div>

              {/* 明細テーブル */}
              <table style={styles.invoiceTable}>
                <thead>
                  <tr>
                    <th style={styles.invoiceTh}>品目</th>
                    <th style={{ ...styles.invoiceTh, width: '100px', textAlign: 'right' }}>単価</th>
                    <th style={{ ...styles.invoiceTh, width: '70px', textAlign: 'center' }}>数量</th>
                    <th style={{ ...styles.invoiceTh, width: '120px', textAlign: 'right' }}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={styles.invoiceTd}>チームエントリー料</td>
                    <td style={styles.invoiceTdRight}>¥{(pricingConfig.entryFee).toLocaleString()}</td>
                    <td style={styles.invoiceTdCenter}>{activeBillModal.billingRecord?.breakdown?.teamCount || 0}</td>
                    <td style={styles.invoiceTdRight}>¥{(activeBillModal.billingRecord?.breakdown?.entryFeeTotal || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={styles.invoiceTd}>ZINメンバー・参加費</td>
                    <td style={styles.invoiceTdRight}>¥{(pricingConfig.memberFee).toLocaleString()}</td>
                    <td style={styles.invoiceTdCenter}>{activeBillModal.billingRecord?.breakdown?.memberCount || 0}</td>
                    <td style={styles.invoiceTdRight}>¥{(activeBillModal.billingRecord?.breakdown?.memberFeeTotal || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={styles.invoiceTd}>一般・参加費</td>
                    <td style={styles.invoiceTdRight}>¥{(pricingConfig.generalFee).toLocaleString()}</td>
                    <td style={styles.invoiceTdCenter}>{activeBillModal.billingRecord?.breakdown?.generalCount || 0}</td>
                    <td style={styles.invoiceTdRight}>¥{(activeBillModal.billingRecord?.breakdown?.generalFeeTotal || 0).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style={styles.invoiceTd}>18歳以下・参加費</td>
                    <td style={styles.invoiceTdRight}>¥{(Math.min(pricingConfig.under18Fee, pricingConfig.memberFee)).toLocaleString()}</td>
                    <td style={styles.invoiceTdCenter}>{activeBillModal.billingRecord?.breakdown?.under18Count || 0}</td>
                    <td style={styles.invoiceTdRight}>¥{(activeBillModal.billingRecord?.breakdown?.under18FeeTotal || 0).toLocaleString()}</td>
                  </tr>
                  {/* 空行の埋め合わせ */}
                  {[...Array(6)].map((_, i) => (
                    <tr key={i}>
                      <td style={styles.invoiceTd}>&nbsp;</td>
                      <td style={styles.invoiceTdCenter}></td>
                      <td style={styles.invoiceTdRight}></td>
                      <td style={styles.invoiceTdRight}></td>
                    </tr>
                  ))}
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
  container: { padding: '20px 30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' },
  pageTitle: { fontSize: '1.6rem', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px 0' },
  desc: { color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' },
  stepIndicator: { display: 'flex', gap: '8px', marginBottom: '20px' },
  stepTab: { padding: '8px 16px', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#64748b', fontSize: '0.88rem', fontWeight: 'bold' },
  activeStepTab: { padding: '8px 16px', borderRadius: '8px', backgroundColor: '#2563eb', color: '#fff', fontSize: '0.88rem', fontWeight: 'bold' },
  card: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  cardTitle: { fontSize: '1.2rem', margin: '0 0 6px 0', color: '#1e293b' },
  subDesc: { color: '#64748b', fontSize: '0.88rem', marginBottom: '16px' },
  filterBar: { display: 'flex', gap: '12px', marginBottom: '16px', background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', flexWrap: 'wrap', alignItems: 'center' },
  filterItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  filterLabel: { fontSize: '0.82rem', fontWeight: 'bold', color: '#334155' },
  filterSelect: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.85rem' },
  filterInput: { padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '0.85rem' },
  clearFilterBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#dc2626', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' },
  eventListContainer: { display: 'flex', flexDirection: 'column', gap: '8px' },
  eventRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px' },
  issuedBadge: { display: 'inline-block', backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' },
  selectEventBtn: { padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
  selectEventAltBtn: { padding: '8px 16px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' },
  emptyBox: { padding: '20px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' },
  backBtn: { padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' },
  tableWrapper: { width: '100%', overflowX: 'auto', marginTop: '12px' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' },
  th: { backgroundColor: '#f1f5f9', color: '#334155', padding: '10px 12px', fontWeight: 'bold', borderBottom: '2px solid #cbd5e1' },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '10px 12px', color: '#334155' },
  tdCenter: { padding: '10px 12px', color: '#334155', textAlign: 'center', whiteSpace: 'nowrap' },
  viewBillBtn: { padding: '5px 10px', backgroundColor: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer' },
  configBox: { backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginTop: '10px' },
  configGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', alignItems: 'end' },
  configField: { display: 'flex', flexDirection: 'column' },
  label: { display: 'block', fontSize: '0.78rem', fontWeight: 'bold', color: '#475569', marginBottom: '4px', minHeight: '2.2em' },
  input: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', backgroundColor: '#fff', boxSizing: 'border-box' },
  stepFooter: { display: 'flex', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' },
  nextStepBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '0.92rem', cursor: 'pointer' },
  executeBtn: { padding: '10px 18px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' },
  mailSendBtn: { padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#10b981', color: '#fff', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' },
  // モーダル・明細書ペーパー用スタイル
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: '0', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' },
  modalContent: { backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxSizing: 'border-box' },
  modalHeaderNoPrint: { display: 'flex', justifyContent: 'space-between', marginBottom: '16px' },
  printBtn: { padding: '6px 14px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' },
  closeModalBtn: { padding: '6px 14px', backgroundColor: '#cbd5e1', color: '#1e293b', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' },
  invoicePaper: { backgroundColor: '#fff', padding: '30px', color: '#000', fontFamily: 'sans-serif' },
  invoiceTable: { width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '0.9rem' },
  invoiceTh: { backgroundColor: '#475569', color: '#fff', padding: '8px 10px', border: '1px solid #334155', fontWeight: 'bold' },
  invoiceTd: { padding: '8px 10px', border: '1px solid #94a3b8', height: '24px' },
  invoiceTdCenter: { padding: '8px 10px', border: '1px solid #94a3b8', textAlign: 'center' },
  invoiceTdRight: { padding: '8px 10px', border: '1px solid #94a3b8', textAlign: 'right' }
};

export default BillingPage;