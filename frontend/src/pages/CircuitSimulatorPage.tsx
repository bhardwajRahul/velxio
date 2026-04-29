/**
 * /circuit-simulator — SEO landing page
 * Target keywords: "circuit simulator", "online circuit simulator",
 * "free circuit simulator", "browser circuit simulator"
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';

const META = getSeoMeta('/circuit-simulator')!;

const FAQ_ITEMS = [
  {
    q: 'Is this circuit simulator really free?',
    a: 'Yes. Velxio is fully free and open-source under the GNU AGPLv3 license. No account required, no cloud subscription, no paywalled components — every part of the simulator runs in your browser.',
  },
  {
    q: 'What kind of analog simulation does Velxio use?',
    a: 'Velxio runs ngspice — the open-source SPICE simulator used by professional EDA tools — compiled to WebAssembly via eecircuit-engine. Each tick performs a full Modified Nodal Analysis solve, so non-linear devices (diodes, BJTs, MOSFETs, op-amps with saturation) behave like real silicon, not idealised approximations.',
  },
  {
    q: 'Can I connect a microcontroller to my circuit?',
    a: 'Yes — and this is the unique feature. GPIO pins drive SPICE nets as voltage sources, and ADC inputs read the solved analog node voltages back into your firmware. You can build a PWM-driven RC filter, a transistor switch, an op-amp signal chain, or a MOSFET motor driver and watch the firmware and circuit interact in real time.',
  },
  {
    q: 'What components are available?',
    a: 'Resistors, capacitors, inductors, potentiometers, photoresistors (LDR), photodiodes, NTC thermistors, batteries (9V/AA/coin), 5 BJTs (2N2222, 2N3055, 2N3906, BC547, BC557), 4 MOSFETs (2N7000, IRF540, IRF9540, FQP27P06), 5 op-amps (LM358, LM741, TL072, LM324, ideal), 4 linear regulators (7805, 7812, 7905, LM317), Zener and Schottky diodes, optocouplers (4N25, PC817), relays, L293D dual H-bridge driver, and 7 logic gates plus 7 74HC-series ICs as DIP-14 packages.',
  },
  {
    q: 'Does the simulator have an oscilloscope and voltmeter?',
    a: 'Yes. Velxio includes a multi-channel oscilloscope, voltmeter, ammeter, and signal generator (sine, square, DC) as live instruments you can drop on the canvas. They probe any node or wire and update in real time as the simulation runs.',
  },
  {
    q: 'Is this a Falstad / CircuitLab / Tinkercad alternative?',
    a: 'For analog circuits, yes — and a more accurate one, since Velxio runs the real ngspice engine instead of a simplified solver. Unlike those tools, Velxio also runs the firmware on the microcontroller driving the circuit, so you can validate firmware + hardware together without leaving the browser.',
  },
];

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio — Free Online Circuit Simulator',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Electronics Simulator',
    operatingSystem: 'Any (browser-based)',
    description:
      'Free online circuit simulator with real-time SPICE analog simulation via ngspice-WASM. 100+ components co-simulated with Arduino, ESP32, RP2040, and ATtiny85 firmware. Live oscilloscope, voltmeter, ammeter.',
    url: 'https://velxio.dev/circuit-simulator',
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
        name: 'Circuit Simulator',
        item: 'https://velxio.dev/circuit-simulator',
      },
    ],
  },
];

export const CircuitSimulatorPage: React.FC = () => {
  useSEO({ ...META, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="seo-hero">
          <h1>
            Free Online Circuit Simulator
            <br />
            <span className="accent">SPICE-accurate analog, in your browser</span>
          </h1>
          <p className="subtitle">
            Drop resistors, capacitors, op-amps, transistors, and regulators on the canvas — every
            part is solved by real ngspice running in WebAssembly. Wire it to Arduino, ESP32, or
            Raspberry Pi Pico firmware and watch them co-simulate. Free, no install, no account.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('circuit-simulator', '/editor')}
            >
              Open Circuit Simulator →
            </Link>
            <Link to="/examples" className="seo-btn-secondary">
              Browse 40+ Analog Examples
            </Link>
          </div>
          <p className="seo-trust">
            Free &amp; open-source · Real ngspice engine · Runs 100% in your browser
          </p>
        </section>

        {/* What */}
        <section className="seo-section">
          <h2>What can you simulate?</h2>
          <p className="lead">
            Velxio runs the real ngspice solver — the same engine professional EDA tools use — on
            every tick. This is not a linear approximation. Diodes have proper forward drop, BJTs
            cut off and saturate, op-amps hit their rails, regulators have dropout.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Passive networks</h3>
              <p>
                Voltage dividers, RC/RL/RLC filters, Wheatstone bridges, capacitor charging curves,
                resonant tank circuits.
              </p>
            </div>
            <div className="seo-card">
              <h3>Diodes &amp; rectifiers</h3>
              <p>
                Half-wave, full-wave bridge rectifiers, Zener regulators, voltage doublers,
                clippers and clampers.
              </p>
            </div>
            <div className="seo-card">
              <h3>Transistor circuits</h3>
              <p>
                BJT common-emitter amplifiers, transistor switches, Darlington pairs, MOSFET drivers,
                H-bridge motor drives, current mirrors.
              </p>
            </div>
            <div className="seo-card">
              <h3>Op-amp circuits</h3>
              <p>
                Inverting/non-inverting amplifiers, summing amps, differential amps, integrators,
                differentiators, Schmitt triggers, comparators.
              </p>
            </div>
            <div className="seo-card">
              <h3>Logic &amp; flip-flops</h3>
              <p>
                AND/OR/NAND/NOR/XOR/XNOR/NOT gates, 74HC-series DIP-14 packages, edge-triggered D /
                T / JK flip-flops, SR latches.
              </p>
            </div>
            <div className="seo-card">
              <h3>Power &amp; sensors</h3>
              <p>
                7805/7812/LM317 regulators, photodiode + transimpedance pipelines, NTC thermistor
                bridges, PIR/flame sensor sliders, optocouplers, relays.
              </p>
            </div>
          </div>
        </section>

        {/* How */}
        <section className="seo-section">
          <h2>How the analog simulation works</h2>
          <p className="lead">
            Velxio uses <strong style={{ color: '#e6edf3' }}>ngspice-WASM</strong> via the
            open-source <code>eecircuit-engine</code>. Every wire on the canvas becomes a SPICE net,
            every component becomes a SPICE device card, and the solver runs full Modified Nodal
            Analysis on each tick.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>1. Wire</h3>
              <p>
                Drop components, drag wires. Velxio union-finds the wire graph into SPICE nets in
                real time as you build.
              </p>
            </div>
            <div className="seo-card">
              <h3>2. Solve</h3>
              <p>
                ngspice solves the full circuit at ~60 Hz. Non-linear devices iterate to convergence
                — no shortcuts, no idealisations.
              </p>
            </div>
            <div className="seo-card">
              <h3>3. Probe</h3>
              <p>
                Drop voltmeters, ammeters, or oscilloscope channels on any node. Live readings
                update as the simulation runs.
              </p>
            </div>
          </div>
        </section>

        {/* Co-simulation */}
        <section className="seo-section">
          <h2>The unique feature: hybrid digital + analog co-simulation</h2>
          <p className="lead">
            Most browser circuit simulators stop at passive analog. Velxio also runs the firmware on
            the microcontroller driving the circuit — on the same clock.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>GPIO drives the circuit</h3>
              <p>
                <code>digitalWrite(HIGH)</code> in your sketch sets a SPICE voltage source HIGH.
                Drive a MOSFET gate, switch a relay, charge a capacitor through a resistor — all
                from real firmware.
              </p>
            </div>
            <div className="seo-card">
              <h3>ADC reads the circuit</h3>
              <p>
                <code>analogRead()</code> returns the SPICE-solved voltage at the input node — after
                the op-amp gain stage, after the divider, after the saturation. What you measure is
                what the circuit produces.
              </p>
            </div>
            <div className="seo-card">
              <h3>Same canvas, same clock</h3>
              <p>
                Arduino + transistor + motor on the same board. ESP32 + photodiode + op-amp + ADC.
                CH32V003 + Zener + LED. Validate firmware and hardware together before soldering.
              </p>
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
          <h2>Ready to simulate your circuit?</h2>
          <p>Open the editor and drop your first SPICE component in seconds — zero setup.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('circuit-simulator', '/editor')}
          >
            Launch Circuit Simulator →
          </Link>
          <div className="seo-internal-links">
            <Link to="/spice-simulator">SPICE Simulator</Link>
            <Link to="/electronics-simulator">Electronics Simulator</Link>
            <Link to="/v2-5">Velxio 2.5 Release</Link>
            <Link to="/examples">Analog Examples</Link>
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/esp32-simulator">ESP32 Simulator</Link>
            <Link to="/raspberry-pi-pico-simulator">RP2040 Simulator</Link>
            <Link to="/custom-chip-simulator">Custom Chip Simulator</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
