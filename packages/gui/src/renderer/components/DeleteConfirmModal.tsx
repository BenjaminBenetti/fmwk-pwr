interface DeleteConfirmModalProps {
  profileName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({ profileName, onCancel, onConfirm }: DeleteConfirmModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000B0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--border-radius)',
          padding: 20,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <span
          style={{
            color: 'var(--danger)',
            fontSize: 14,
            fontFamily: 'var(--font)',
          }}
        >
          // delete_profile
        </span>

        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            fontFamily: 'var(--font)',
            lineHeight: 1.5,
          }}
        >
          are you sure you want to delete '{profileName}'? this action cannot be undone.
        </span>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              height: 40,
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--border-radius)',
              color: 'var(--text-dim)',
              fontSize: 12,
              letterSpacing: 0.5,
              fontFamily: 'var(--font)',
              cursor: 'pointer',
            }}
          >
            cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              flex: 1,
              height: 40,
              background: 'var(--danger)',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              fontFamily: 'var(--font)',
              borderRadius: 'var(--border-radius)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}
