/**
 * /custom-chip-simulator — SEO landing page
 * Target keywords: "custom chip simulator", "custom chip arduino",
 * "wokwi custom chips", "build custom ic"
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';

const META = getSeoMeta('/custom-chip-simulator')!;

const FAQ_ITEMS = [
  {
    q: 'What is a custom chip in Velxio?',
    a: 'A custom chip is a user-defined integrated circuit. You write the chip\'s logic in C, Rust, or AssemblyScript — Velxio compiles it to WebAssembly, instantiates it on the canvas like any other component, and drives its pins from the simulator.',
  },
  {
    q: 'Which API does Velxio use?',
    a: 'Velxio implements the Wokwi Custom Chips API — the same API used by Wokwi — so chips you write for Velxio are portable to Wokwi and vice versa. Velxio adds a WASI shim so you can use standard library functions in your chip code.',
  },
  {
    q: 'What can I build?',
    a: 'Behavioural models of real ICs (sensors, decoders, level translators, protocol bridges), custom digital logic, sensor stand-ins for hardware you don\'t have yet, and protocol-level mocks for testing firmware. Chips can drive pins, read attributes, register timers, and bridge to I²C / SPI buses.',
  },
  {
    q: 'How do I share or reuse a chip?',
    a: 'Save the chip to your Velxio account and reuse it across projects. The chip definition includes its pin layout, attributes, and the compiled WASM — drop it onto any project canvas like a built-in component.',
  },
  {
    q: 'Do I need a backend to run my chip?',
    a: 'No. Compiled chip WASM runs in the same browser tab as the rest of the simulation. Pin updates, attribute reads, and timer ticks are all local.',
  },
  {
    q: 'Can my custom chip talk to an Arduino?',
    a: 'Yes — that is the typical use case. Wire its pins to Arduino GPIOs, SPI, or I²C lines and the firmware on the Arduino interacts with your chip exactly like a real IC.',
  },
];

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio — Free Online Custom Chip Simulator',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'IC Authoring & Simulation',
    operatingSystem: 'Any (browser-based)',
    description:
      'Define your own integrated circuits in C, Rust, or AssemblyScript using the Wokwi-compatible Custom Chips API. Compile to WebAssembly and drive pins, attributes, timers, I²C and SPI from your simulated chip. Free and open-source.',
    url: 'https://velxio.dev/custom-chip-simulator',
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
        name: 'Custom Chip Simulator',
        item: 'https://velxio.dev/custom-chip-simulator',
      },
    ],
  },
];

export const CustomChipSimulatorPage: React.FC = () => {
  useSEO({ ...META, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="seo-hero">
          <h1>
            Build Your Own Custom Chips
            <br />
            <span className="accent">in C, Rust or AssemblyScript</span>
          </h1>
          <p className="subtitle">
            Define your own integrated circuits with the Wokwi-compatible Custom Chips API. Write
            the chip in C, Rust, or AssemblyScript; Velxio compiles it to WebAssembly and runs it on
            the canvas like any other component — driven by Arduino, ESP32, or RP2040 firmware.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('custom-chip-simulator', '/editor')}
            >
              Open the Editor →
            </Link>
            <Link to="/docs/intro" className="seo-btn-secondary">
              Read the Docs
            </Link>
          </div>
          <p className="seo-trust">
            Wokwi-compatible API · Free &amp; open-source · WASM-powered, runs in your browser
          </p>
        </section>

        {/* What you can do */}
        <section className="seo-section">
          <h2>What can you build?</h2>
          <p className="lead">
            Custom chips fill the gaps between built-in components. If a real IC isn't on the
            shelf, build a behavioural model and your firmware never knows the difference.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Sensor stand-ins</h3>
              <p>
                Mock a temperature, pressure, or IMU sensor that responds over I²C — useful when
                you don't have the part yet but want to develop the firmware.
              </p>
            </div>
            <div className="seo-card">
              <h3>Protocol bridges</h3>
              <p>
                Build a UART-to-I²C bridge, an SPI shift register, a digital-to-analog wrapper, or
                a custom level translator.
              </p>
            </div>
            <div className="seo-card">
              <h3>Custom logic</h3>
              <p>
                Glue logic, state machines, address decoders, debouncers — anything you'd otherwise
                wire up with discrete gates.
              </p>
            </div>
            <div className="seo-card">
              <h3>Behavioural ICs</h3>
              <p>
                Re-create the externally-visible behaviour of a real IC (a 7-segment driver, a
                stepper controller) without simulating its analog internals.
              </p>
            </div>
            <div className="seo-card">
              <h3>Test fixtures</h3>
              <p>
                Inject signals on schedule, capture pin transitions, validate firmware against
                expected pin-level behaviour.
              </p>
            </div>
            <div className="seo-card">
              <h3>Reusable libraries</h3>
              <p>
                Save the chip to your account, import it into other projects, share with the
                community.
              </p>
            </div>
          </div>
        </section>

        {/* API capabilities */}
        <section className="seo-section">
          <h2>What the API gives you</h2>
          <p className="lead">
            The Velxio Custom Chips runtime is fully Wokwi-compatible, with extras for the SPICE
            and multi-board environment.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Pin I/O</h3>
              <p>
                Read pin state, write digital high/low, configure pull-ups, react to edges with
                pin-watch callbacks.
              </p>
            </div>
            <div className="seo-card">
              <h3>Attributes</h3>
              <p>
                Read user-configurable chip attributes from the property panel — values, strings,
                numbers — and re-read on change.
              </p>
            </div>
            <div className="seo-card">
              <h3>Timers</h3>
              <p>
                Schedule callbacks at microsecond resolution. The runtime fires them aligned to the
                simulator clock.
              </p>
            </div>
            <div className="seo-card">
              <h3>I²C bus</h3>
              <p>
                Connect to any wire that's part of an I²C bus, respond to start/stop conditions,
                acknowledge addresses, send / receive bytes.
              </p>
            </div>
            <div className="seo-card">
              <h3>SPI bus</h3>
              <p>
                Bidirectional SPI with chip-select handling. Implement a shift register, an SPI
                memory, or a sensor with one byte-stream callback.
              </p>
            </div>
            <div className="seo-card">
              <h3>WASI shim</h3>
              <p>
                A small WASI shim lets your C/Rust chip use standard-library calls (printf, string
                ops, math) without a heavy runtime.
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
          <h2>Build your first custom chip</h2>
          <p>Open the editor and create a chip in seconds — pick C, Rust, or AssemblyScript.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('custom-chip-simulator', '/editor')}
          >
            Launch the Editor →
          </Link>
          <div className="seo-internal-links">
            <Link to="/circuit-simulator">Circuit Simulator</Link>
            <Link to="/spice-simulator">SPICE Simulator</Link>
            <Link to="/electronics-simulator">Electronics Simulator</Link>
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/esp32-simulator">ESP32 Simulator</Link>
            <Link to="/raspberry-pi-pico-simulator">RP2040 Simulator</Link>
            <Link to="/attiny85-simulator">ATtiny85 Simulator</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
