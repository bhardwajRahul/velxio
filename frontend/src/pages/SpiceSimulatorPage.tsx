/**
 * /spice-simulator — SEO landing page
 * Target keywords: "spice simulator online", "ngspice browser",
 * "free spice simulator", "spice in browser"
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';

const META = getSeoMeta('/spice-simulator')!;

const FAQ_ITEMS = [
  {
    q: 'Is this real ngspice running in my browser?',
    a: 'Yes. Velxio loads ngspice compiled to WebAssembly via the open-source eecircuit-engine. The same SPICE engine that powers professional EDA workflows runs in your browser tab — no server, no install.',
  },
  {
    q: 'What kind of analysis does it run?',
    a: 'Real-time transient analysis. The solver runs Modified Nodal Analysis on every tick (~60 Hz) so you see waveforms evolve as the circuit runs. Non-linear devices iterate to convergence at every step.',
  },
  {
    q: 'Which SPICE device models are supported?',
    a: 'Resistors, capacitors, inductors, ideal voltage and current sources, diodes (1N4148, 1N4007, 1N5817, 1N5819, Zener 1N4733), BJTs (2N2222, 2N3055, 2N3906, BC547, BC557), MOSFETs (2N7000, IRF540, IRF9540, FQP27P06 — Level 3 model), op-amps (LM358, LM741, TL072, LM324, ideal) with saturation rails, linear regulators (7805, 7812, 7905, LM317), optocouplers (4N25, PC817), and relay coils with inductance.',
  },
  {
    q: 'Can I write raw SPICE netlists?',
    a: 'Velxio builds the netlist for you from the schematic — wire components on the canvas and the simulator generates the SPICE cards. You don’t have to handwrite netlists, but the underlying engine is full ngspice and accepts standard device cards.',
  },
  {
    q: 'Does it include instruments?',
    a: 'Yes — multi-channel oscilloscope, voltmeter, ammeter, and signal generator (sine / square / DC, configurable frequency, amplitude, offset). All instruments probe live SPICE node voltages and branch currents.',
  },
  {
    q: 'Can SPICE talk to a microcontroller?',
    a: 'Yes. This is the unique feature. Arduino / ESP32 / RP2040 / ATtiny85 GPIOs drive SPICE voltage sources; ADC inputs read solved node voltages. Build a real firmware-driven analog signal chain end-to-end in one tool.',
  },
];

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio — Free Online SPICE Simulator (ngspice-WASM)',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'SPICE Circuit Simulator',
    operatingSystem: 'Any (browser-based)',
    description:
      'Free online SPICE simulator running ngspice in WebAssembly. Real device models, full Modified Nodal Analysis, live oscilloscope and meters. Co-simulates with Arduino, ESP32, RP2040, and ATtiny85 firmware.',
    url: 'https://velxio.dev/spice-simulator',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'David Montero Crespo' },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Velxio', item: 'https://velxio.dev/' },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'SPICE Simulator',
        item: 'https://velxio.dev/spice-simulator',
      },
    ],
  },
];

export const SpiceSimulatorPage: React.FC = () => {
  useSEO({ ...META, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="seo-hero">
          <h1>
            Free SPICE Simulator Online
            <br />
            <span className="accent">Real ngspice, in your browser</span>
          </h1>
          <p className="subtitle">
            Velxio runs the open-source ngspice engine compiled to WebAssembly. Real device models,
            full Modified Nodal Analysis, live transient simulation — and you can wire it to real
            Arduino / ESP32 / RP2040 firmware. Free, no install, no account.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('spice-simulator', '/editor')}
            >
              Open SPICE Simulator →
            </Link>
            <Link to="/v2-5" className="seo-btn-secondary">
              See Velxio 2.5 Release
            </Link>
          </div>
          <p className="seo-trust">
            Real ngspice · Free &amp; open-source · Runs 100% in your browser
          </p>
        </section>

        {/* Why */}
        <section className="seo-section">
          <h2>Why Velxio for SPICE?</h2>
          <p className="lead">
            Browser SPICE has historically meant either no SPICE at all (linear approximators) or
            hosted-only tools that need an account. Velxio runs the real engine, locally, for free.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Real ngspice</h3>
              <p>
                Same engine as professional EDA workflows, compiled to WebAssembly via
                eecircuit-engine. No simplified solver — full MNA, full device library.
              </p>
            </div>
            <div className="seo-card">
              <h3>No server, no account</h3>
              <p>
                The solver runs in your browser tab. Your circuits never leave your machine. Works
                offline after the first load.
              </p>
            </div>
            <div className="seo-card">
              <h3>Co-simulates with firmware</h3>
              <p>
                Arduino / ESP32 / RP2040 / ATtiny85 GPIOs drive SPICE sources, ADCs read solved node
                voltages. The unique combo no other in-browser tool offers.
              </p>
            </div>
          </div>
        </section>

        {/* Devices */}
        <section className="seo-section">
          <h2>Device library</h2>
          <p className="lead">
            Every component on the canvas maps to a real ngspice device card — not a behavioural
            stand-in.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Passives</h3>
              <p>Resistors, capacitors (electrolytic / ceramic / polarity-aware), inductors, potentiometers, photoresistors (LDR), photodiodes, NTC thermistors.</p>
            </div>
            <div className="seo-card">
              <h3>Diodes</h3>
              <p>1N4148, 1N4007, 1N5817 / 1N5819 (Schottky), Zener 1N4733 — with proper forward drop, reverse breakdown, and recovery.</p>
            </div>
            <div className="seo-card">
              <h3>BJTs</h3>
              <p>2N2222, 2N3055 (high-current NPN), 2N3906, BC547, BC557 — with cutoff, active region, and saturation behaviour.</p>
            </div>
            <div className="seo-card">
              <h3>MOSFETs</h3>
              <p>2N7000 (small-signal N-channel), IRF540 (power N-channel), IRF9540 (power P-channel), FQP27P06 — Level 3 model.</p>
            </div>
            <div className="seo-card">
              <h3>Op-amps</h3>
              <p>LM358, LM741, TL072, LM324, ideal — with realistic saturation rails so output clipping looks correct.</p>
            </div>
            <div className="seo-card">
              <h3>Linear regulators</h3>
              <p>7805, 7812, 7905, LM317 — with dropout voltage. Build a complete power supply on the canvas.</p>
            </div>
            <div className="seo-card">
              <h3>Logic ICs</h3>
              <p>74HC-series DIP-14 packages, basic gates (AND/OR/NAND/NOR/XOR/XNOR/NOT), edge-triggered D/T/JK flip-flops, SR latches.</p>
            </div>
            <div className="seo-card">
              <h3>Power-stage parts</h3>
              <p>L293D dual H-bridge, optocouplers (4N25, PC817 with CTR), SPDT relays with coil inductance, hysteresis, and flyback diode.</p>
            </div>
            <div className="seo-card">
              <h3>Sources &amp; instruments</h3>
              <p>9V / AA / coin batteries with realistic ESR, signal generator (sine / square / DC), oscilloscope, voltmeter, ammeter.</p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="seo-section">
          <h2>Frequently Asked Questions</h2>
          <dl className="seo-faq">
            {FAQ_ITEMS.map(({ q, a }) => (
              <React.Fragment key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </React.Fragment>
            ))}
          </dl>
        </section>

        {/* Bottom CTA */}
        <div className="seo-bottom">
          <h2>Run real SPICE — no install, no account</h2>
          <p>Open the editor and start solving real circuits in seconds.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('spice-simulator', '/editor')}
          >
            Launch SPICE Simulator →
          </Link>
          <div className="seo-internal-links">
            <Link to="/circuit-simulator">Circuit Simulator</Link>
            <Link to="/electronics-simulator">Electronics Simulator</Link>
            <Link to="/v2-5">Velxio 2.5 Release</Link>
            <Link to="/examples">Analog Examples</Link>
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/esp32-simulator">ESP32 Simulator</Link>
            <Link to="/custom-chip-simulator">Custom Chip Simulator</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
