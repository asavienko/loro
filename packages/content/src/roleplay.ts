/**
 * Bundled roleplay scenes.
 *
 * This is the local floor for plan 76. It deliberately has no provider, network,
 * account, or learner-input dependency, so both the mobile app and API fallback can
 * use the exact same authored material. The small set is a development foundation;
 * expanding it requires the bilingual review gate in plan 87.
 */

export interface RoleplayOption {
  es: string
  en: string
  best?: boolean
  tip: string
  phrase_id?: string
}

export interface RoleplayTurn {
  npc: { es: string; en: string }
  options: RoleplayOption[]
}

export interface RoleplayScene {
  place: string
  city: string
  emoji: string
  role: string
  turns: RoleplayTurn[]
  closer: { es: string; en: string }
}

/** Increment only when the authored fallback changes incompatibly. */
export const BUNDLED_ROLEPLAY_SCHEMA_VERSION = 1
export const BUNDLED_ROLEPLAY_CONTENT_VERSION = 1
export const DEFAULT_ROLEPLAY_THEME = 'Café'

const CAFE_SCENE: RoleplayScene = {
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

const HOTEL_SCENE: RoleplayScene = {
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

const SCENES: Readonly<Record<string, RoleplayScene>> = Object.freeze({
  Café: CAFE_SCENE,
  Hotel: HOTEL_SCENE,
})

/** The names a local UI may offer; every one has a bundled completion path. */
export function bundledRoleplayThemes(): readonly string[] {
  return Object.keys(SCENES)
}

/** Unknown themes intentionally return the default instead of a provider-generated substitute. */
export function bundledRoleplayScene(theme: string): RoleplayScene {
  return SCENES[theme] ?? CAFE_SCENE
}
