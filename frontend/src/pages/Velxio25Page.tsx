/**
 * /v2-5 — Velxio 2.5 Release Landing Page
 * Highlights ngspice-WASM analog co-simulation, expanded SPICE catalog,
 * real-time instruments (ammeter, voltmeter, oscilloscope), and the new
 * hybrid digital+analog workflow.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';
import './Velxio2Page.css';

const GITHUB_URL = 'https://github.com/davidmonterocrespo24/velxio';
const DISCORD_URL = 'https://discord.gg/3mARjJrh4E';

/* ── SVG Icons (no emojis) ─────────────────────────────── */
const IcoRocket = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
  </svg>
);

const IcoWave = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h3l3-9 4 18 3-12 3 6h4" />
  </svg>
);

const IcoResistor = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12h4l1-3 2 6 2-6 2 6 2-6 1 3h6" />
  </svg>
);

const IcoTransistor = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8" />
    <path d="M9 7v10M9 12h6l-3-4M15 12l-3 4" />
  </svg>
);

const IcoMeter = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 12l4-4" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

const IcoChip = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="5" width="14" height="14" rx="2" />
    <rect x="9" y="9" width="6" height="6" />
    <path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" />
  </svg>
);

const IcoSensor = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IcoLightning = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IcoBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const IcoTestTube = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2" />
    <path d="M8.5 2h7" />
    <path d="M14.5 16h-5" />
  </svg>
);

const IcoGitHub = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const IcoDiscord = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const IcoStar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio 2.5 — Arduino + SPICE Analog Circuit Simulator',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any (browser-based)',
    softwareVersion: '2.5.0',
    description:
      'Velxio 2.5 brings real-time ngspice-WASM analog simulation to the browser. Hybrid digital+analog co-simulation: resistors, capacitors, inductors, op-amps, transistors, voltmeters, ammeters — wired to Arduino, ESP32, RP2040 GPIO/ADC. 40+ circuit examples. Free and open-source.',
    url: 'https://velxio.dev/v2-5',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'David Montero Crespo' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Velxio', item: 'https://velxio.dev/' },
      { '@type': 'ListItem', position: 2, name: 'Velxio 2.5', item: 'https://velxio.dev/v2-5' },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is new in Velxio 2.5?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Velxio 2.5 adds real-time analog circuit simulation via ngspice-WASM. You can now mix SPICE-accurate analog parts — resistors, capacitors, inductors, diodes, transistors, op-amps, voltage regulators — with Arduino, ESP32, and RP2040 boards on the same canvas. Includes live ammeters, voltmeters, an oscilloscope, and 40+ new circuit examples.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this a SPICE simulator in the browser?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Velxio 2.5 runs ngspice compiled to WebAssembly (via eecircuit-engine) entirely in the browser. No server, no install, no account. Works offline after first load.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I connect an Arduino to analog components?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. GPIO pins drive SPICE nets as voltage sources, and ADC inputs read analog node voltages back into the firmware. analogRead() returns the real SPICE-solved value at that net.',
        },
      },
    ],
  },
];

const CHANGE_SECTIONS = [
  {
    icon: <IcoWave />,
    title: 'ngspice-WASM Engine',
    color: '#007acc',
    items: [
      'ngspice compiled to WebAssembly via eecircuit-engine (lazy-loaded)',
      'Real-time transient analysis at ~60 Hz solve rate',
      'Full Modified Nodal Analysis — not a linear approximation',
      'Always-on mode: every circuit is SPICE-solved, no toggle needed',
      'Browser-native — no server, no install, no account',
      'Works offline after first load',
    ],
  },
  {
    icon: <IcoResistor />,
    title: 'Passive Components',
    color: '#4a9e6b',
    items: [
      'Resistor — custom value + common presets (220Ω, 1k, 10k, 100k)',
      'Capacitor — electrolytic, ceramic, polarity-aware (10nF–1mF)',
      'Inductor — custom value + presets (100µH–10mH)',
      'Potentiometer — live slider updates SPICE resistance',
      'Photoresistor (LDR) and Photodiode — lux-driven',
      'NTC thermistor — temperature-driven resistance',
    ],
  },
  {
    icon: <IcoTransistor />,
    title: 'Active Semiconductors',
    color: '#c8701a',
    items: [
      '5 BJTs: 2N2222, 2N3055, 2N3906, BC547, BC557',
      '4 MOSFETs: 2N7000, IRF540, IRF9540, FQP27P06 (P/N-channel)',
      '5 op-amps: LM358, LM741, TL072, LM324, ideal — with saturation rails',
      '4 linear regulators: 7805, 7812, 7905, LM317 with dropout',
      'Diodes: 1N4148, 1N4007, 1N5817, 1N5819, Zener 1N4733',
      'Optocouplers 4N25 and PC817 with CTR modelling',
    ],
  },
  {
    icon: <IcoChip />,
    title: 'Logic & Integrated Circuits',
    color: '#8957e5',
    items: [
      '7 basic logic gates: AND, OR, NAND, NOR, XOR, XNOR, NOT',
      '8 multi-input gates (3 and 4 inputs)',
      '7 74HC-series ICs as DIP-14 packages',
      '3 flip-flops: D, T, JK (edge-triggered digital)',
      'Relay (SPDT) with coil inductance, hysteresis, flyback diode',
      'L293D dual H-bridge motor driver',
    ],
  },
  {
    icon: <IcoMeter />,
    title: 'Live Instruments',
    color: '#a8304d',
    items: [
      'Ammeter — live current reading wired between any two nodes',
      'Voltmeter — live node voltage with probe leads',
      'Oscilloscope with multi-channel capture',
      'Signal generator — sine, square, DC (configurable frequency, amplitude, offset)',
      'Batteries: 9V, AA, coin-cell with realistic ESR',
      'LED brightness scales with actual current',
    ],
  },
  {
    icon: <IcoLightning />,
    title: 'Board Co-Simulation',
    color: '#b08800',
    items: [
      'Digital GPIO pins drive SPICE nets as voltage sources in real time',
      'ADC inputs read solved analog node voltages back into firmware',
      'analogRead() returns real SPICE-solved node values',
      'Arduino + transistor + motor — wired and solved together',
      'ESP32 + op-amp + sensor — co-simulated end-to-end',
      'Board-less circuits — pure analog workbenches are now a first-class mode',
    ],
  },
  {
    icon: <IcoSensor />,
    title: 'Sensor Sliders',
    color: '#4a9e6b',
    items: [
      'Photodiode illumination slider (0–1000 lux)',
      'Photoresistor illumination slider with LDR curve',
      'NTC temperature slider (-40–125 °C)',
      'Gas sensor, flame sensor, tilt switch — live panels',
      'Property changes invalidate the netlist memo → next tick re-solves',
      'Live sliders while running, number inputs while stopped',
    ],
  },
  {
    icon: <IcoTestTube />,
    title: 'Examples & Testing',
    color: '#1a7f37',
    items: [
      '40 new analog/hybrid circuit examples added',
      'Voltage dividers, RC filters, op-amp amplifiers, rectifiers',
      'Transistor switches, relay drivers, H-bridge circuits',
      'Full-wave rectifier, Wheatstone bridge, Schmitt trigger',
      'End-to-end SPICE behaviour tests (capacitor charging, rectification)',
      '164+ sandbox tests passing against ngspice reference results',
    ],
  },
  {
    icon: <IcoBook />,
    title: 'Docs & DX',
    color: '#6e7681',
    items: [
      'New circuit-emulation.md — implementation deep-dive',
      'Electrical simulation user guide in the docs site',
      'ngspice gotchas documented (unicode in titles, MOSFET Level=3)',
      'Separated useElectricalStore for clean state boundaries',
      'Reference sandbox in test/test_circuit/ for fast iteration',
      'VITE_ELECTRICAL_SIM build flag to disable if needed',
    ],
  },
];

export const Velxio25Page: React.FC = () => {
  useSEO({ ...getSeoMeta('/v2-5')!, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* ── Hero ── */}
        <section className="v2-hero">
          <div className="v2-version-badge">
            <IcoRocket /> Version 2.5
          </div>
          <h1>
            Velxio 2.5
            <br />
            <span className="accent">Arduino meets SPICE in your browser</span>
          </h1>
          <p className="subtitle">
            Real-time analog circuit simulation via ngspice-WASM, wired to Arduino, ESP32, and
            Raspberry Pi Pico. Resistors, capacitors, op-amps, transistors, live ammeters and
            voltmeters — co-simulated with your firmware. Free, open-source, no install.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('velxio-v2-5', '/editor')}
            >
              <IcoLightning />
              Try Velxio 2.5
            </Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="seo-btn-secondary">
              <IcoGitHub /> View on GitHub
            </a>
          </div>

          <div className="v2-community-row">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="v2-community-btn v2-star-btn">
              <IcoStar />
              <span>Star on GitHub</span>
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="v2-community-btn v2-discord-btn">
              <IcoDiscord />
              <span>Join Discord</span>
            </a>
          </div>
        </section>

        {/* ── Why SPICE matters ── */}
        <section className="seo-section">
          <h2>From digital-only to full circuit emulation</h2>
          <p className="lead">
            Velxio 2.0 simulated your firmware perfectly. Velxio 2.5 simulates the circuit around
            it — with the same ngspice engine used by professional EDA tools, running entirely in
            your browser tab.
          </p>

          <div className="seo-grid">
            <div className="seo-card">
              <h3>Not a linear approximation</h3>
              <p>
                Velxio solves the full Modified Nodal Analysis every tick. Non-linear devices —
                diodes, BJTs, MOSFETs, op-amps with saturation — behave like the real thing, not
                like textbook idealisations.
              </p>
            </div>
            <div className="seo-card">
              <h3>Real firmware. Real circuit. Same canvas.</h3>
              <p>
                GPIO pins drive SPICE nets as voltage sources. ADC inputs read solved node
                voltages. <code>analogRead()</code> returns what the circuit actually produces —
                not a simulated shortcut.
              </p>
            </div>
            <div className="seo-card">
              <h3>100% browser, 100% offline</h3>
              <p>
                ngspice compiled to WebAssembly via the open-source eecircuit-engine. No server, no
                cloud, no account. Works offline after the first load. Your circuits never leave
                your machine.
              </p>
            </div>
          </div>
        </section>

        {/* ── Component catalog ── */}
        <section className="seo-section">
          <h2>100+ SPICE-accurate components</h2>
          <p className="lead">
            A complete electronics catalogue — passives, semiconductors, logic, instruments —
            every one of them modelled with real ngspice device cards, not behavioural stand-ins.
          </p>

          <div className="v2-changelog">
            {CHANGE_SECTIONS.map((section) => (
              <div key={section.title} className="v2-change-block">
                <div className="v2-change-header" style={{ color: section.color }}>
                  {section.icon}
                  <h3>{section.title}</h3>
                </div>
                <ul className="v2-change-list">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Co-simulation highlight ── */}
        <section className="seo-section">
          <h2>Hybrid digital + analog co-simulation</h2>
          <p className="lead">
            Most browser simulators run either your firmware OR a circuit — never both together.
            Velxio 2.5 solves them on the same clock.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Drive a motor from an Arduino pin</h3>
              <p>
                Pin HIGH → MOSFET gate → drain current through a real inductive load → back-EMF
                through a flyback diode. All SPICE-solved. Scope the gate and drain voltages side
                by side.
              </p>
            </div>
            <div className="seo-card">
              <h3>Read a sensor through a real op-amp</h3>
              <p>
                Photodiode → transimpedance op-amp → ADC. Adjust the lux slider and watch
                <code>analogRead()</code> respond through the actual amplifier stage — saturation,
                slew rate, and all.
              </p>
            </div>
            <div className="seo-card">
              <h3>Debug with live instruments</h3>
              <p>
                Drop an ammeter between any two nodes, a voltmeter on any net. The oscilloscope
                captures digital pins and analog nodes together. No "what if" — just
                measurements.
              </p>
            </div>
          </div>
        </section>

        {/* ── Examples ── */}
        <section className="seo-section">
          <h2>40 new analog & hybrid examples</h2>
          <p className="lead">
            Pre-wired circuits you can open in one click — from textbook fundamentals to realistic
            Arduino+analog systems.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Fundamentals</h3>
              <p>
                Voltage divider, RC low-pass filter, RC high-pass filter, LR circuit, capacitor
                charging, RLC resonance, Wheatstone bridge.
              </p>
            </div>
            <div className="seo-card">
              <h3>Diodes & rectifiers</h3>
              <p>
                Half-wave rectifier, full-wave bridge rectifier, Zener regulator, clamper,
                clipper, voltage doubler.
              </p>
            </div>
            <div className="seo-card">
              <h3>Op-amp circuits</h3>
              <p>
                Inverting amplifier, non-inverting amplifier, summing amp, differential amp,
                integrator, differentiator, Schmitt trigger, comparator.
              </p>
            </div>
            <div className="seo-card">
              <h3>Transistor circuits</h3>
              <p>
                Common-emitter amplifier, transistor switch, Darlington pair, MOSFET driver, H-bridge,
                current mirror.
              </p>
            </div>
            <div className="seo-card">
              <h3>Arduino + analog</h3>
              <p>
                PWM-driven LED with RC smoothing, Arduino-controlled MOSFET motor driver, opto-isolated
                relay, photodiode + op-amp + ADC pipeline.
              </p>
            </div>
            <div className="seo-card">
              <h3>Sensors</h3>
              <p>
                NTC thermistor bridge, photoresistor light meter, photodiode transimpedance,
                potentiometer dimmer, flame detector.
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/examples" className="seo-btn-secondary">
              Browse All Examples
            </Link>
          </div>
        </section>

        {/* ── Outcome ── */}
        <section className="seo-section">
          <h2>The outcome</h2>
          <p className="lead">
            Velxio 2.5 closes the loop between firmware and hardware: the same tool that runs your
            sketch now solves the circuit around it.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Teach & learn electronics</h3>
              <p>
                A free, browser-based SPICE playground for students — with the added benefit of
                driving real microcontroller firmware. No license, no install, no lab booking.
              </p>
            </div>
            <div className="seo-card">
              <h3>Prototype before soldering</h3>
              <p>
                Validate analog front-ends, power stages, and sensor pipelines end-to-end before
                you order a single part. The scope and DMM are already on the bench.
              </p>
            </div>
            <div className="seo-card">
              <h3>Still 100% open source</h3>
              <p>
                AGPL-3.0 on GitHub. Built on ngspice, eecircuit-engine, avr8js, rp2040js, QEMU,
                and wokwi-elements. Fork it, host it, extend it.
              </p>
            </div>
          </div>
        </section>

        {/* ── Built on ── */}
        <section className="seo-section">
          <h2>Built on open-source</h2>
          <p className="lead">
            Velxio 2.5 stands on the shoulders of decades of electronics tooling. Huge thanks to
            the maintainers of every project below.
          </p>
          <div className="v2-repos">
            <a href="https://ngspice.sourceforge.io/" target="_blank" rel="noopener noreferrer" className="v2-repo-card">
              <IcoGitHub />
              <div>
                <h3>ngspice</h3>
                <p>The open-source SPICE circuit simulator — powers every analog solve in Velxio 2.5</p>
              </div>
            </a>
            <a href="https://github.com/danchitnis/eecircuit-engine" target="_blank" rel="noopener noreferrer" className="v2-repo-card">
              <IcoGitHub />
              <div>
                <h3>eecircuit-engine</h3>
                <p>ngspice compiled to WebAssembly — the bridge that makes browser SPICE possible</p>
              </div>
            </a>
            <a href="https://github.com/wokwi/avr8js" target="_blank" rel="noopener noreferrer" className="v2-repo-card">
              <IcoGitHub />
              <div>
                <h3>avr8js</h3>
                <p>AVR8 CPU emulator in JavaScript — Arduino Uno, Nano, Mega, ATtiny85</p>
              </div>
            </a>
            <a href="https://github.com/wokwi/rp2040js" target="_blank" rel="noopener noreferrer" className="v2-repo-card">
              <IcoGitHub />
              <div>
                <h3>rp2040js</h3>
                <p>RP2040 emulator — Raspberry Pi Pico and Pico W</p>
              </div>
            </a>
            <a href="https://github.com/wokwi/wokwi-elements" target="_blank" rel="noopener noreferrer" className="v2-repo-card">
              <IcoGitHub />
              <div>
                <h3>wokwi-elements</h3>
                <p>Web Components for electronic parts — LEDs, buttons, sensors, displays</p>
              </div>
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="v2-repo-card v2-repo-card--primary">
              <IcoGitHub />
              <div>
                <h3>Velxio</h3>
                <p>This project — free, open-source Arduino + SPICE co-simulator</p>
              </div>
            </a>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <div className="seo-bottom">
          <h2>Try Velxio 2.5 now</h2>
          <p>Open the editor and start simulating — firmware and analog circuit, same canvas, zero setup.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('velxio-v2-5', '/editor')}
          >
            Launch Simulator
          </Link>

          <div className="v2-bottom-community">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="v2-community-btn v2-star-btn">
              <IcoStar />
              <span>Star on GitHub</span>
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="v2-community-btn v2-discord-btn">
              <IcoDiscord />
              <span>Join Discord</span>
            </a>
          </div>

          <div className="seo-internal-links">
            <Link to="/">Home</Link>
            <Link to="/v2">Velxio 2.0</Link>
            <Link to="/examples">Examples</Link>
            <Link to="/docs/intro">Documentation</Link>
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/esp32-simulator">ESP32 Simulator</Link>
            <Link to="/raspberry-pi-pico-simulator">RP2040 Simulator</Link>
            <Link to="/about">About</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
