export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
      <div className="text-4xl mb-3">📭</div>
      <p className="text-sm mb-3">{message}</p>
      {action}
    </div>
  );
}
