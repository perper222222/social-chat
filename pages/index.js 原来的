import { useEffect, useState, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const [userId, setUserId] = useState('');
  const [entered, setEntered] = useState(false);
  const [text, setText] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const arr = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(arr);
      setLoading(false);
      // scroll to bottom when new messages arrive
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => unsub();
  }, []);

  const handleEnter = () => {
    if (!/^[0-9]+$/.test(userId)) {
      alert('아이디는 숫자만 입력해 주세요.');
      return;
    }
    setEntered(true);
  }

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: userId,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (err) {
      console.error(err);
      alert('메시지 전송 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  }

  if (!entered) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-4">간단 채팅 입장</h1>
          <p className="text-sm text-gray-600 mb-4">숫자 하나를 입력하여 실험 식별자로 사용하세요. 예: 12345</p>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="숫자 ID 입력"
            className="w-full border p-3 rounded-lg mb-4"
            inputMode="numeric"
          />
          <button onClick={handleEnter} className="w-full bg-blue-600 text-white p-3 rounded-lg">입장</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow p-4 flex items-center justify-between">
        <h2 className="font-bold">실시간 소셜 토론</h2>
        <div className="text-sm text-gray-600">ID: {userId}</div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-4">
          <div className="space-y-4">
            {loading ? (
              <div className="text-center text-gray-500">로딩 중...</div>
            ) : (
              posts.map(p => (
                <div key={p.id} className={`p-3 rounded-lg ${p.userId === userId ? 'bg-blue-50 self-end' : 'bg-gray-50'}`}>
                  <div className="text-xs text-gray-500 mb-1">사용자 {p.userId}</div>
                  <div className="text-sm">{p.text}</div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      </main>

      <footer className="p-4 bg-white shadow">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="메시지를 입력하세요"
            className="flex-1 border rounded-xl p-3"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          />
          <button onClick={handleSend} className="bg-blue-600 text-white px-4 py-2 rounded-xl">전송</button>
        </div>
      </footer>
    </div>
  )
}

