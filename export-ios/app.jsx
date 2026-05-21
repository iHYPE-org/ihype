// iHYPE iOS app — composition

function App() {
  return (
    <DesignCanvas
      title="iHYPE · iOS app"
      subtitle="Mocked from ihype.org content. Each row is a screen group — drag to pan, ⌘+scroll to zoom, click any label to focus."
    >

      <DCSection
        id="onboarding"
        title="1 · Onboarding"
        subtitle="Welcome → role → cohort. The marketing-page promises become first-touch product moments."
      >
        <DCArtboard id="welcome" label="Welcome" width={414} height={870}>
          <PhoneFrame><ScrWelcome /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="pick-role" label="Pick role · /register?role=" width={414} height={870}>
          <PhoneFrame><ScrPickRole /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="cohort" label="Cohort · 70/20/10 mix setup" width={414} height={870}>
          <PhoneFrame><ScrCohort /></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="daily"
        title="2 · Daily loop · the iHYPE moment"
        subtitle="Home → Seeds → Hype-cast. The product the marketing page sells, fully wired."
      >
        <DCArtboard id="home" label="Home · Tonight's queue" width={414} height={870}>
          <PhoneFrame><ScrHome /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="seeds" label="Seeds · swipe deck" width={414} height={870}>
          <PhoneFrame><MobileSeed /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="now-playing" label="Now Playing · full-track" width={414} height={870}>
          <PhoneFrame><ScrNowPlaying /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="hype-moment" label="Hype cast · verified" width={414} height={870}>
          <PhoneFrame><MobileHypeMoment /></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="charts"
        title="3 · Charts & artist surfaces"
        subtitle="The viral, public, audit-able chart. The artist page that is the share target."
      >
        <DCArtboard id="rising" label="Rising · Chicago" width={414} height={870}>
          <PhoneFrame><ScrCharts /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="artist" label="Artist · Maya Reyes" width={414} height={870}>
          <PhoneFrame><ScrArtistProfile /></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="shows"
        title="4 · Shows · the 'show up, earn more' loop"
        subtitle="Discover → ticket → check-in → +10 boost. The promise the homepage makes."
      >
        <DCArtboard id="shows-list" label="Shows · this week" width={414} height={870}>
          <PhoneFrame><ScrShows /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="show-detail" label="Show detail · 0% fees" width={414} height={870}>
          <PhoneFrame><ScrShowDetail /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="checkin" label="QR ticket · at the door" width={414} height={870}>
          <PhoneFrame><MobileCheckIn /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="checkin-success" label="+10 · 1.5× boost" width={414} height={870}>
          <PhoneFrame><MobileCheckInSuccess /></PhoneFrame>
        </DCArtboard>
      </DCSection>

      <DCSection
        id="you"
        title="5 · You · identity, privacy, ledger"
        subtitle="The personal surface. Taste map, privacy receipts, and a route into the public transparency ledger."
      >
        <DCArtboard id="profile" label="You · Hype log + taste map" width={414} height={870}>
          <PhoneFrame><ScrYou /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="settings" label="Privacy · Data Ethics live" width={414} height={870}>
          <PhoneFrame><ScrSettings /></PhoneFrame>
        </DCArtboard>
        <DCArtboard id="transparency" label="Transparency · the ledger" width={414} height={870}>
          <PhoneFrame><ScrTransparency /></PhoneFrame>
        </DCArtboard>
      </DCSection>

    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
