export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Something went wrong</p>
      <p className="state__message">{message}</p>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="state state--empty">
      <p className="state__title">{title}</p>
      <p className="state__message">{message}</p>
    </div>
  );
}