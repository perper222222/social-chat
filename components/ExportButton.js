export default function ExportButton({ messages }) {
  const exportToCSV = () => {
    if (!messages || messages.length === 0) return;

    const headers = ["ID", "사용자ID", "메시지", "시간"];
    const rows = messages.map(m => [
      m.id,
      m.userId,
      m.text,
      m.timestamp
        ? new Date(
            m.timestamp.seconds
              ? m.timestamp.seconds * 1000
              : m.timestamp
          ).toLocaleString()
        : ""
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "chat_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={exportToCSV}
      className="bg-yellow-500 text-white px-4 py-2 rounded"
    >
      내보내기
    </button>
  );
}
