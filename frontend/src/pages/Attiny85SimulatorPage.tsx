/**
 * /attiny85-simulator — SEO landing page
 * Target keywords: "attiny85 simulator", "attiny85 emulator",
 * "attiny85 online simulator", "free attiny85 simulator"
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader';
import { useSEO } from '../utils/useSEO';
import { getSeoMeta } from '../seoRoutes';
import { trackClickCTA } from '../utils/analytics';
import './SEOPage.css';

const META = getSeoMeta('/attiny85-simulator')!;

const FAQ_ITEMS = [
  {
    q: 'Is this a real ATtiny85 emulator?',
    a: 'Yes. Velxio uses avr8js — the cycle-accurate AVR8 emulator — to execute compiled ATtiny85 firmware byte-for-byte exactly as it would run on a real DIP-8 chip.',
  },
  {
    q: 'Which ATtiny85 features are supported?',
    a: 'All 6 GPIO pins (PB0–PB5), Timer0 (8-bit) with PWM, Timer1 (8-bit) with PWM and high-speed mode, the watchdog timer, 10-bit ADC with 4 input channels (ADC0–ADC3), USI peripheral for I²C (TWI) and SPI bit-banging, pin-change interrupts, and external interrupts (INT0).',
  },
  {
    q: 'How do I program the ATtiny85 in Velxio?',
    a: 'Write your sketch in the Monaco editor in C/C++ (Arduino syntax). Velxio compiles it via the bundled arduino-cli using the ATTinyCore board package and produces a real .hex file — the same one you would flash via USBasp.',
  },
  {
    q: 'Can I use Arduino-compatible libraries?',
    a: 'Yes. The Library Manager indexes the full Arduino library registry. Many libraries work on ATtiny85 with appropriate pin assignments — TinyWireM for I²C, SoftwareSerial via USI, TinyServo, etc.',
  },
  {
    q: 'Can I wire it to analog circuits?',
    a: 'Yes. Velxio includes a real-time SPICE solver — wire the ATtiny85 ADC pin to a voltage divider, an op-amp output, or an NTC thermistor bridge and analogRead() will return the actual SPICE-solved voltage at that pin.',
  },
  {
    q: 'Is it free?',
    a: 'Yes — Velxio is fully free and open-source under GNU AGPLv3. No account required.',
  },
];

const JSON_LD: object[] = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Velxio — Free Online ATtiny85 Simulator',
    applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'AVR Microcontroller Emulator',
    operatingSystem: 'Any (browser-based)',
    description:
      'Free online ATtiny85 simulator with cycle-accurate AVR8 emulation. All 6 I/O pins, Timer0/Timer1 PWM, 10-bit ADC, USI for I²C/SPI, watchdog. Wire it to real SPICE analog circuits.',
    url: 'https://velxio.dev/attiny85-simulator',
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
        name: 'ATtiny85 Simulator',
        item: 'https://velxio.dev/attiny85-simulator',
      },
    ],
  },
];

export const Attiny85SimulatorPage: React.FC = () => {
  useSEO({ ...META, jsonLd: JSON_LD });

  return (
    <div className="seo-page">
      <AppHeader />
      <main>
        {/* Hero */}
        <section className="seo-hero">
          <h1>
            Free ATtiny85 Simulator
            <br />
            <span className="accent">Cycle-accurate AVR emulation in your browser</span>
          </h1>
          <p className="subtitle">
            Write Arduino code for the ATtiny85 and run it instantly — every AVR opcode is emulated
            faithfully. All 6 I/O pins, USI for I²C/SPI, Timer0/Timer1 PWM, 10-bit ADC, watchdog.
            Wire it to real SPICE analog circuits. Free, no install, no account.
          </p>
          <div className="seo-cta-group">
            <Link
              to="/editor"
              className="seo-btn-primary"
              onClick={() => trackClickCTA('attiny85-simulator', '/editor')}
            >
              Open ATtiny85 Simulator →
            </Link>
            <Link to="/examples" className="seo-btn-secondary">
              Browse ATtiny85 Examples
            </Link>
          </div>
          <p className="seo-trust">
            Free &amp; open-source · cycle-accurate avr8js · No signup
          </p>
        </section>

        {/* Specs */}
        <section className="seo-section">
          <h2>ATtiny85 specs in the simulator</h2>
          <p className="lead">
            Everything you need to develop ATtiny85 firmware without a programmer or breadboard.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Core</h3>
              <p>
                AVR 8-bit RISC, 8 KB flash, 512 B SRAM, 512 B EEPROM. DIP-8 pinout (PB0–PB5 plus
                VCC/GND).
              </p>
            </div>
            <div className="seo-card">
              <h3>GPIO</h3>
              <p>
                6 I/O pins on PORTB. Configurable as input / output / pull-up. Pin-change interrupts
                (PCINT0–PCINT5) and external INT0.
              </p>
            </div>
            <div className="seo-card">
              <h3>Timers &amp; PWM</h3>
              <p>
                Timer0 (8-bit) with two PWM channels on PB0/PB1. Timer1 (8-bit) with high-speed
                mode and two PWM channels on PB1/PB4 — useful for higher-frequency PWM.
              </p>
            </div>
            <div className="seo-card">
              <h3>ADC</h3>
              <p>
                10-bit ADC with 4 input channels (ADC0 on PB5, ADC1 on PB2, ADC2 on PB4, ADC3 on
                PB3). Internal 1.1 V reference.
              </p>
            </div>
            <div className="seo-card">
              <h3>USI</h3>
              <p>
                Universal Serial Interface — bit-bangs I²C (TWI) and SPI. Compatible with TinyWireM
                / TinyWireS and standard SPI libraries.
              </p>
            </div>
            <div className="seo-card">
              <h3>Watchdog &amp; sleep</h3>
              <p>
                Watchdog timer with reset and interrupt modes. Power-down, ADC noise reduction, and
                idle sleep modes — handy for low-power demos.
              </p>
            </div>
          </div>
        </section>

        {/* What you can do */}
        <section className="seo-section">
          <h2>What can you build?</h2>
          <p className="lead">
            ATtiny85 projects shine when they're small, low-power, and analog-aware — exactly
            Velxio's strength with the SPICE solver wired in.
          </p>
          <div className="seo-grid">
            <div className="seo-card">
              <h3>Blink &amp; PWM fade</h3>
              <p>
                The classic intros — hardware-PWM-driven LED fading on PB1 via Timer0, and
                high-speed Timer1 PWM on PB4.
              </p>
            </div>
            <div className="seo-card">
              <h3>Button-driven LEDs</h3>
              <p>
                Read a button on PB2 with internal pull-up, debounce in firmware, drive an LED on
                PB0.
              </p>
            </div>
            <div className="seo-card">
              <h3>NTC temperature</h3>
              <p>
                Read an NTC thermistor / fixed-resistor divider on ADC1 — the SPICE solver returns
                the real divided voltage to <code>analogRead()</code>.
              </p>
            </div>
            <div className="seo-card">
              <h3>I²C peripherals via USI</h3>
              <p>
                Talk to an OLED, an EEPROM, or an RTC on PB0/PB2 using TinyWireM. Bus traffic is
                emulated end-to-end.
              </p>
            </div>
            <div className="seo-card">
              <h3>SPI WS2812 / shift</h3>
              <p>
                Bit-bang via USI to drive a WS2812 string or a 74HC595 shift register on a couple of
                pins.
              </p>
            </div>
            <div className="seo-card">
              <h3>Analog switching</h3>
              <p>
                Drive a MOSFET gate from PB1 PWM through a SPICE-modelled gate-charge curve — see
                the slew-rate effect on the load.
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
          <h2>Develop ATtiny85 firmware without hardware</h2>
          <p>Open the editor and start coding — compile, simulate, and probe in seconds.</p>
          <Link
            to="/editor"
            className="seo-btn-primary"
            onClick={() => trackClickCTA('attiny85-simulator', '/editor')}
          >
            Launch ATtiny85 Simulator →
          </Link>
          <div className="seo-internal-links">
            <Link to="/arduino-simulator">Arduino Simulator</Link>
            <Link to="/atmega328p-simulator">ATmega328P Simulator</Link>
            <Link to="/arduino-mega-simulator">Mega 2560 Simulator</Link>
            <Link to="/circuit-simulator">Circuit Simulator</Link>
            <Link to="/spice-simulator">SPICE Simulator</Link>
            <Link to="/custom-chip-simulator">Custom Chip Simulator</Link>
            <Link to="/examples">Examples</Link>
          </div>
        </div>
      </main>
    </div>
  );
};
