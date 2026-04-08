import WallCalendar from './components/WallCalendar';

function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 16px',
        boxSizing: 'border-box',
        background: 'linear-gradient(135deg, #2D2420 0%, #1A1210 50%, #0D0A08 100%)',
      }}
    >
      <WallCalendar />
    </main>
  );
}

export default App;
