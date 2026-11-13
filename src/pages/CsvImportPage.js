import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

const CsvImportPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [leaderCsvData, setLeaderCsvData] = useState([]);
  const [leaderFileName, setLeaderFileName] = useState('');
  const [uploadingLeaders, setUploadingLeaders] = useState(false);

  // 曲インポート用の状態
  const [songCsvData, setSongCsvData] = useState([]);
  const [songFileName, setSongFileName] = useState('');
  const [uploadingSongs, setUploadingSongs] = useState(false);

  // 汎用的なCSV/TSVパース関数
  const parseGenericCSV = (text, type) => {
    const lines = text.trim().split(/\r\n|\n/);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
    
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const row = {};

      headers.forEach((header, index) => {
        const val = values[index] || '';
        const h = header.toLowerCase();

        if (type === 'leader') {
          if (h.includes('lid')) row.lid = val;
          else if (h.includes('代表者名') || h.includes('name') || h.includes('氏名')) row.name = val;
          else if (h.includes('フリガナ') || h.includes('kana') || h.includes('ふりがな')) row.kana = val;
          else if (h.includes('email') || h.includes('メール') || h.includes('アドレス')) row.email = val;
          else if (h.includes('会員') || h.includes('no') || h.includes('memberno')) row.memberNo = val;
        } else if (type === 'song') {
          if (h.includes('zin') || h.includes('mm') || h.includes('zinormm')) row.zinOrMm = val;
          else if (h.includes('disc') || h.includes('ディスク')) row.discNo = val;
          else if (h.includes('曲名') || h.includes('title') || h.includes('song')) row.title = val;
          else if (h.includes('ジャンル') || h.includes('genre')) row.genre = val;
          else if (h.includes('長さ') || h.includes('time') || h.includes('duration') || h.includes('mmss')) row.duration = val;
        }
      });
      result.push(row);
    }
    return result;
  };

  // --- 代表者インポート ---
  const handleLeaderFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLeaderFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setLeaderCsvData(parseGenericCSV(evt.target.result, 'leader'));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportLeaders = async () => {
    if (leaderCsvData.length === 0) return alert('登録する代表者データがありません');

    try {
      setUploadingLeaders(true);
      const batch = writeBatch(db);
      const instructorsRef = collection(db, 'instructors');

      leaderCsvData.forEach((item) => {
        if (!item.lid) return;
        const docRef = doc(instructorsRef, item.lid);
        batch.set(docRef, {
          lid: item.lid,
          name: item.name || '',
          kana: item.kana || '',
          email: item.email || '',
          memberNo: item.memberNo || '',
          createdAt: new Date().toISOString().split('T')[0]
        });
      });

      await batch.commit();
      alert(`${leaderCsvData.length} 件の代表者データを登録しました！`);
      setLeaderCsvData([]);
      setLeaderFileName('');
    } catch (error) {
      console.error('代表者登録エラー:', error);
      alert('代表者の登録に失敗しました。');
    } finally {
      setUploadingLeaders(false);
    }
  };

  // --- 曲情報インポート ---
  const handleSongFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSongFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setSongCsvData(parseGenericCSV(evt.target.result, 'song'));
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportSongs = async () => {
    if (songCsvData.length === 0) return alert('登録する曲データがありません');

    try {
      setUploadingSongs(true);
      const batch = writeBatch(db);
      // 曲は全体のマスタ、またはイベント配下など適宜調整可能ですが、通常曲マスタ用コレクション 'songs' に登録します
      const songsRef = collection(db, 'songs');
      const today = new Date().toISOString().split('T')[0];

      songCsvData.forEach((item) => {
        const newDocRef = doc(songsRef);
        batch.set(newDocRef, {
          zinOrMm: item.zinOrMm || '',
          discNo: item.discNo || '',
          title: item.title || '無題の曲',
          genre: item.genre || '',
          duration: item.duration || '',
          createdAt: today,
          updatedAt: today
        });
      });

      await batch.commit();
      alert(`${songCsvData.length} 件の曲データを一括登録しました！`);
      setSongCsvData([]);
      setSongFileName('');
    } catch (error) {
      console.error('曲登録エラー:', error);
      alert('曲の登録に失敗しました。');
    } finally {
      setUploadingSongs(false);
    }
  };

  return (
    <div style={styles.container}>
      <button onClick={() => navigate(`/events/${eventId}`)} style={styles.backBtn}>
        ← イベント詳細に戻る
      </button>

      <h1 style={styles.pageTitle}>CSVデータ一括移行・登録</h1>

      {/* 1. 代表者情報インポート */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>1. 代表者情報のインポート</h2>
        <p style={styles.desc}>
          対象項目: <code>LID</code>, <code>代表者名</code>, <code>代表者フリガナ</code>, <code>Emailアドレス</code>, <code>会員No</code>
        </p>

        <div style={styles.fileInputBox}>
          <input type="file" accept=".csv,.txt" onChange={handleLeaderFileUpload} />
          {leaderFileName && <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>選択中: <strong>{leaderFileName}</strong></p>}
        </div>

        {leaderCsvData.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>プレビュー（{leaderCsvData.length} 件）</p>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>LID</th>
                    <th style={styles.th}>代表者名</th>
                    <th style={styles.th}>フリガナ</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>会員No</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderCsvData.map((row, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{row.lid}</td>
                      <td style={styles.td}>{row.name}</td>
                      <td style={styles.td}>{row.kana}</td>
                      <td style={styles.td}>{row.email}</td>
                      <td style={styles.td}>{row.memberNo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleImportLeaders} disabled={uploadingLeaders} style={styles.importBtn}>
              {uploadingLeaders ? '登録中...' : `${leaderCsvData.length} 件の代表者を登録実行`}
            </button>
          </div>
        )}
      </div>

      {/* 2. 曲情報インポート */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>2. 曲情報のインポート</h2>
        <p style={styles.desc}>
          対象項目: <code>ZINorMM</code>, <code>DiscNo</code>, <code>曲名</code>, <code>ジャンル</code>, <code>曲の長さ(MM:SS)</code>
        </p>

        <div style={styles.fileInputBox}>
          <input type="file" accept=".csv,.txt" onChange={handleSongFileUpload} />
          {songFileName && <p style={{ marginTop: '8px', fontSize: '0.85rem' }}>選択中: <strong>{songFileName}</strong></p>}
        </div>

        {songCsvData.length > 0 && (
          <div style={{ marginTop: '15px' }}>
            <p style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>プレビュー（{songCsvData.length} 件）</p>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>ZIN / MM</th>
                    <th style={styles.th}>DiscNo</th>
                    <th style={styles.th}>曲名</th>
                    <th style={styles.th}>ジャンル</th>
                    <th style={styles.th}>曲の長さ</th>
                  </tr>
                </thead>
                <tbody>
                  {songCsvData.map((row, idx) => (
                    <tr key={idx} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 'bold' }}>{row.zinOrMm}</td>
                      <td style={styles.td}>{row.discNo}</td>
                      <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>{row.title}</td>
                      <td style={styles.td}>{row.genre}</td>
                      <td style={styles.td}>{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={handleImportSongs} disabled={uploadingSongs} style={styles.importBtn}>
              {uploadingSongs ? '登録中...' : `${songCsvData.length} 件の曲データを登録実行`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '20px 30px', backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' },
  backBtn: { marginBottom: '15px', padding: '6px 14px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', fontSize: '0.85rem', color: '#475569' },
  pageTitle: { fontSize: '1.6rem', margin: '0 0 20px 0', color: '#0f172a' },
  card: { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '25px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' },
  sectionTitle: { fontSize: '1.2rem', margin: '0 0 8px 0', color: '#1e293b' },
  desc: { color: '#64748b', fontSize: '0.88rem', margin: '0 0 15px 0' },
  fileInputBox: { border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '16px', textAlign: 'center', background: '#f8fafc' },
  importBtn: { marginTop: '15px', padding: '10px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer' },
  tableWrapper: { maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '8px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' },
  th: { backgroundColor: '#f1f5f9', padding: '8px 12px', textAlign: 'left', position: 'sticky', top: 0 },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '8px 12px', whiteSpace: 'nowrap', color: '#334155' }
};

export default CsvImportPage;