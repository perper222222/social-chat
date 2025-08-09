export default function Home() {
  // ... 你的state和逻辑保持不变

  if (!entered) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen px-4">
        <p className="text-gray-600 mb-2">이 채팅방은 익명 채팅방입니다.</p>
        <input
          type="text"
          placeholder="숫자 신분 ID를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="border p-2 rounded w-full max-w-md"
        />
        <button
          onClick={() => setEntered(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded w-full max-w-md mt-4"
        >
          채팅 입장
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex flex-col bg-white border shadow-lg"
      style={{ maxHeight: "100vh" }}
    >
      {/* 下载 & 清除按钮 */}
      <div className="flex justify-between items-center p-4 border-b">
        <button
          onClick={downloadChat}
          className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-800"
        >
          다운로드
        </button>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
          >
            채팅 기록 삭제
          </button>
          <span className="text-sm text-red-500 select-none">
            클릭하지 마세요
          </span>
        </div>
      </div>

      {/* 聊天框 */}
      <div
        className="flex-grow overflow-y-auto p-4"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && (
          <p className="text-center text-gray-400 mt-10">채팅 기록이 없습니다.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="mb-4 border-b pb-2">
            <div className="text-xs text-gray-500">
              {m.timestamp
                ? new Date(
                    m.timestamp.seconds
                      ? m.timestamp.seconds * 1000
                      : m.timestamp
                  ).toLocaleString()
                : ""}
            </div>
            <div>
              <strong>{m.userId}</strong>: {m.text}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框和发送按钮 */}
      <div className="flex space-x-2 p-4 border-t">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="border p-2 flex-grow rounded"
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button
          onClick={sendMessage}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          전송
        </button>
      </div>
    </div>
  );
}
