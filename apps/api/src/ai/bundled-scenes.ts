/**
 * The bundled fallback scenes.
 *
 * Hand-authored, not placeholders — this is what an offline learner gets, what local
 * development uses, and what every failed provider call degrades to. Rule 9: AI has a
 * bundled fallback on every learner-visible path (ADR-0010).
 *
 * Data only. Held apart from `ai.service.ts` so the pipeline that selects and validates
 * a scene is readable without scrolling past 170 lines of Spanish.
 */

import type { Scene } from './scene.js'

const CAFE_SCENE: Scene = {
  place: 'Café Central',
  city: 'Madrid',
  emoji: '☕',
  role: 'Camarero',
  turns: [
    {
      npc: { es: '¡Buenas! ¿Qué le pongo?', en: 'Hi there! What can I get you?' },
      options: [
        {
          es: 'Un cortado, por favor.',
          en: 'A cortado, please.',
          best: true,
          tip: 'Perfecto — short, and exactly how locals order.',
          phrase_id: 'cafe1',
        },
        {
          es: '¿Qué me recomienda?',
          en: 'What do you recommend?',
          tip: 'Nice opener — it invites the waiter to help.',
        },
        {
          es: '¿Tienen leche de avena?',
          en: 'Do you have oat milk?',
          tip: 'Good stretch — "de avena" = oat.',
          phrase_id: 'cafe2',
        },
      ],
    },
    {
      npc: {
        es: 'Claro. ¿Algo más? ¿Un dulce, quizá?',
        en: 'Sure. Anything else? A pastry, maybe?',
      },
      options: [
        {
          es: 'No, gracias. Eso es todo.',
          en: "No thanks, that's all.",
          best: true,
          tip: '"Eso es todo" = that\'s all — a clean way to close an order.',
        },
        {
          es: 'Sí, una tarta de Santiago.',
          en: 'Yes, an almond cake.',
          tip: 'A very Spanish dessert — great pick.',
        },
        {
          es: '¿Qué dulces tienen?',
          en: 'What pastries do you have?',
          tip: 'Curious and natural.',
        },
      ],
    },
    {
      npc: { es: 'Muy bien. Son cuatro con cincuenta.', en: "Very good. That'll be four fifty." },
      options: [
        {
          es: 'Aquí tiene. Quédese con el cambio.',
          en: 'Here you go. Keep the change.',
          best: true,
          tip: '"Quédese con el cambio" = keep the change. Smooth!',
        },
        {
          es: '¿Puedo pagar con tarjeta?',
          en: 'Can I pay by card?',
          tip: 'Practical — card works almost everywhere now.',
        },
        {
          es: '¿Está incluido el servicio?',
          en: 'Is service included?',
          tip: 'Good to ask — tipping is optional in Spain.',
        },
      ],
    },
  ],
  closer: { es: '¡Gracias! ¡Que vaya bien!', en: 'Thank you! Have a good one!' },
}

const HOTEL_SCENE: Scene = {
  place: 'Hotel Reina',
  city: 'Madrid',
  emoji: '🏨',
  role: 'Recepcionista',
  turns: [
    {
      npc: { es: 'Buenas tardes. ¿En qué puedo ayudarle?', en: 'Good afternoon. How can I help?' },
      options: [
        {
          es: 'Tengo una reserva.',
          en: 'I have a reservation.',
          best: true,
          tip: 'Direct and expected — exactly what reception wants to hear first.',
          phrase_id: 'htl1',
        },
        {
          es: '¿Tienen habitaciones libres?',
          en: 'Do you have any rooms free?',
          tip: 'For walk-ins — useful to know.',
        },
        {
          es: '¿Habla inglés?',
          en: 'Do you speak English?',
          tip: 'A fine safety net, but try the Spanish first.',
          phrase_id: 'srv3',
        },
      ],
    },
    {
      npc: {
        es: 'Perfecto. Aquí tiene la llave. Habitación 304.',
        en: 'Perfect. Here is your key. Room 304.',
      },
      options: [
        {
          es: '¿A qué hora es el desayuno?',
          en: 'What time is breakfast?',
          best: true,
          tip: 'The most useful check-in question there is.',
          phrase_id: 'htl2',
        },
        {
          es: '¿Hay wifi en la habitación?',
          en: 'Is there wifi in the room?',
          tip: 'Ask now — it saves a trip back down.',
          phrase_id: 'htl3',
        },
        {
          es: 'Gracias, muy amable.',
          en: 'Thank you, very kind.',
          tip: '"Muy amable" is warm and very Spanish.',
        },
      ],
    },
    {
      npc: { es: 'De siete a diez y media. ¿Algo más?', en: 'Seven to ten thirty. Anything else?' },
      options: [
        {
          es: 'No, eso es todo. Gracias.',
          en: "No, that's everything. Thanks.",
          best: true,
          tip: 'Closes politely without over-explaining.',
        },
        {
          es: '¿Dónde está la parada de taxis?',
          en: "Where's the taxi stand?",
          tip: 'Worth asking while you have their attention.',
          phrase_id: 'trv1',
        },
        {
          es: '¿Me lo puede repetir?',
          en: 'Can you repeat that?',
          tip: 'Never be shy about this one.',
          phrase_id: 'srv1',
        },
      ],
    },
  ],
  closer: { es: 'Que disfrute de su estancia.', en: 'Enjoy your stay.' },
}

/**
 * The café scene is the default, and it is a named constant rather than a lookup so
 * "there is always a good fallback" is a fact of the type system, not a `!`.
 */
const DEFAULT_SCENE = CAFE_SCENE

const BUNDLED: Record<string, Scene> = {
  Café: CAFE_SCENE,
  Hotel: HOTEL_SCENE,
}

/** The theme served when a request names none. */
export const DEFAULT_THEME = 'Café'

/** The bundled scene for a theme — the default one for a theme we don't carry. */
export function bundledScene(theme: string): Scene {
  return BUNDLED[theme] ?? DEFAULT_SCENE
}

/**
 * The themes on offer.
 *
 * Read from the BUNDLED set, not from the active provider, and that is deliberate: a
 * provider that invented themes would offer a learner a theme with no bundled scene
 * behind it, which is exactly the promise rule 9 makes.
 */
export function bundledThemes(): string[] {
  return Object.keys(BUNDLED)
}
