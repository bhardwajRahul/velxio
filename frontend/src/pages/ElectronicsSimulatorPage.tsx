/**
 * /electronics-simulator — SEO landing page
 * Target keywords: "electronics simulator", "online electronics simulator",
 * "free electronics simulator", "online breadboard"
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';

const META = getSeoMeta('/electronics-simulator')!;

const FAQ_ITEMS = [
  {
    q: 'Is Velxio a complete electronics simulator?',
    a: 'Yes. Velxio combines a SPICE-accurate analog solver, 19 simulated microcontrollers (Arduino, ESP32, RP2040, ATtiny85, Raspberry Pi 3), 100+ components, an oscilloscope, voltmeter, ammeter, and signal generator — everything you need to design and validate an electronics project end-to-end.',
  },
  {
    q: 'Can I use it like a virtual breadboard?',
    a: 'Yes. Drop components on the canvas, drag wires between pins, and the simulator builds the SPICE netlist automatically. Wires snap to a grid; components rotate in 90° increments; signal-type colours mark VCC, GND, digital, and analog routes.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Open velxio.dev in any modern browser and start. Compilation of Arduino sketches uses the cloud arduino-cli backend, but the SPICE solver and AVR / RP2040 / RISC-V emulators all run locally in your browser.',
  },
  {
    q: 'Is it good for teaching electronics?',
    a: 'Yes — that is one of the design goals. Free, no install, no account, no licence cost. 100+ pre-wired example circuits cover voltage dividers, RC filters, op-amp amplifiers, transistor switches, rectifiers, and complete Arduino projects. Great for university labs and self-learners.',
  },
  {
    q: 'Is Velxio a Tinkercad / Falstad alternative?',
    a: 'Yes — and a more accurate one. Velxio runs real ngspice (the engine professional EDA tools use), and unlike those tools it also runs the firmware on the microcontroller driving the circuit. Open-source under AGPLv3.',
  },
];

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio — Free Online Electronics Simulator',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Electronics Simulator',
    operatingSystem: 'Any (browser-based)',
    description:
      'Free online electronics simulator. SPICE-accurate analog parts wired to 19 simulated microcontrollers. 100+ components, oscilloscope, voltmeter, ammeter — your virtual breadboard.',
    url: 'https://velxio.dev/electronics-simulator',
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
        name: 'Electronics Simulator',
        item: 'https://velxio.dev/electronics-simulator',
      },
    ],
  },
];

export const ElectronicsSimulatorPage: React.FC = () => {
  useSEO({ ...META, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="seo-hero">
          <h1>
            Free Online Electronics Simulator
            <br />
            <span className="accent">Build, wire and test in your browser</span>
          </h1>
          <p className="subtitle">
            A complete electronics workbench: SPICE-accurate analog parts, 19 simulated
            microcontrollers (Arduino, ESP32, RP2040, ATtiny85, Raspberry Pi 3), 100+ components,
            and live instruments — all in one canvas. Free, no install, no account.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('electronics-simulator', '/editor')}
            >
              Open Electronics Simulator →
            </Link>
            <Link to="/examples" className="seo-btn-secondary">
              Browse 100+ Examples
            </Link>
          </div>
          <p className="seo-trust">
            Free &amp; open-source · No signup required · Real SPICE + real CPU emulation
          </p>
        </section>

        {/* What's inside */}
        <section className="seo-section">
          <h2>What's inside</h2>
          <p className="lead">
            One tool, every layer of an electronics project — from the resistor on your breadboard
            to the firmware on your microcontroller.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>SPICE analog solver</h3>
              <p>
                Real ngspice via WebAssembly. 100+ device cards: passives, BJTs, MOSFETs, op-amps,
                regulators, diodes, optocouplers, relays.
              </p>
            </div>
            <div className="seo-card">
              <h3>19 microcontrollers</h3>
              <p>
                Arduino Uno / Nano / Mega / ATtiny85 / Leonardo / Pro Mini, Raspberry Pi Pico (W),
                ESP32 / ESP32-S3 / ESP32-CAM / Nano ESP32, ESP32-C3 family, CH32V003, Raspberry Pi
                3B Linux.
              </p>
            </div>
            <div className="seo-card">
              <h3>Custom chips</h3>
              <p>
                Define your own ICs in C, Rust, or AssemblyScript via the Wokwi Custom Chips API —
                drive pins, attributes, timers, I²C and SPI from your code.
              </p>
            </div>
            <div className="seo-card">
              <h3>Live instruments</h3>
              <p>
                Multi-channel oscilloscope, voltmeter, ammeter, signal generator (sine / square /
                DC) — drop on any node and watch waveforms live.
              </p>
            </div>
            <div className="seo-card">
              <h3>48+ visual components</h3>
              <p>
                LEDs, RGB LEDs, 7-segment displays, 16×2 LCD, ILI9341 TFT, NeoPixel strips, servos,
                buzzers, ultrasonic sensors, DHT22, MPU6050, keypads.
              </p>
            </div>
            <div className="seo-card">
              <h3>Arduino IDE built in</h3>
              <p>
                Monaco code editor, multi-file workspace, Library Manager (full Arduino library
                index), arduino-cli compiler, Serial Monitor.
              </p>
            </div>
          </div>
        </section>

        {/* For teachers / students */}
        <section className="seo-section">
          <h2>For teachers, students &amp; tinkerers</h2>
          <p className="lead">
            Velxio is free under AGPLv3 — no licence cost, no per-seat pricing, no cloud account.
            Self-host with one Docker command for university labs.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>For courses</h3>
              <p>
                Use the same tool from week-1 (Ohm’s law, voltage dividers) through Arduino projects
                and op-amp signal chains. One UI for the whole syllabus.
              </p>
            </div>
            <div className="seo-card">
              <h3>For labs</h3>
              <p>
                Self-host on a campus server. No internet dependency, no account walls — students
                just open the URL.
              </p>
            </div>
            <div className="seo-card">
              <h3>For makers</h3>
              <p>
                Validate your circuit and firmware before ordering parts. The scope and DMM are
                already on the bench.
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
          <h2>Open your virtual breadboard</h2>
          <p>Wire your first circuit in seconds — no setup, no install, no account.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('electronics-simulator', '/editor')}
          >
            Launch Electronics Simulator →
          </Link>
          <div className="seo-internal-links">
            <Link to="/circuit-simulator">Circuit Simulator</Link>
            <Link to="/spice-simulator">SPICE Simulator</Link>
            <Link to="/v2-5">Velxio 2.5 Release</Link>
            <Link to="/examples">All Examples</Link>
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/esp32-simulator">ESP32 Simulator</Link>
            <Link to="/raspberry-pi-pico-simulator">RP2040 Simulator</Link>
            <Link to="/attiny85-simulator">ATtiny85 Simulator</Link>
            <Link to="/custom-chip-simulator">Custom Chip Simulator</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
