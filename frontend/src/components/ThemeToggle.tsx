// Ljust/mörkt tema som i Volymstudie: växlar mot systemets val och sparas i localStorage ("tema").
export function ThemeToggle() {
  const vaxla = () => {
    const root = document.documentElement;
    const mork = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const nu = root.dataset.tema || (mork ? 'mork' : 'ljus');
    const ny = nu === 'mork' ? 'ljus' : 'mork';
    root.dataset.tema = ny;
    try {
      localStorage.setItem('tema', ny);
    } catch {
      /* privat läge – temat gäller bara den här sidvisningen */
    }
  };

  return (
    <button
      type="button"
      onClick={vaxla}
      title="Byt mellan ljust och mörkt tema"
      aria-label="Byt tema"
      className="inline-grid place-items-center w-8 h-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
