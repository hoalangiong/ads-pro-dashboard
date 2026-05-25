export default function Badge({ level }) {
  const map = {
    good: 'bg-green-900 text-green-300',
    warning: 'bg-yellow-900 text-yellow-300',
    danger: 'bg-red-900 text-red-300',
    info: 'bg-blue-900 text-blue-300',
  };
  const labels = { good: 'Tốt', warning: 'Cảnh báo', danger: 'Nguy hiểm', info: 'Thông tin' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[level] || map.info}`}>
      {labels[level] || level}
    </span>
  );
}
