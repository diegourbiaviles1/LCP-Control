// Original reflections, not attributed quotations or literal Bible verses.
export const reflections = [
  'Que Dios bendiga el trabajo de tus manos y la intención de tu corazón.',
  'Empieza con gratitud. Lo pequeño también merece celebrarse.',
  'Haz lo que esté en tus manos y entrega a Dios lo que no puedes controlar.',
  'Que hoy encuentres paz en lo sencillo y alegría en lo compartido.',
  'El esfuerzo de cada día también es una forma de esperanza.',
  'Trabajar con honestidad deja una huella que permanece.',
  'Un gesto amable puede cambiar el día de alguien.',
  'Dale tiempo a lo que estás construyendo con amor.',
  'Que la fe te acompañe en los comienzos y la paciencia en el camino.',
  'Hoy tienes otra oportunidad de hacer el bien.',
  'Cuida tus sueños con la misma ternura con la que cuidas a los tuyos.',
  'La gratitud nos ayuda a reconocer cuánto hemos recibido.',
  'No necesitas resolverlo todo hoy. Da el siguiente paso con calma.',
  'Que nunca te falten motivos para agradecer ni personas con quienes compartir.',
  'Pon amor en tu trabajo, incluso en lo que nadie ve.',
  'Una oración sencilla también puede ser un nuevo comienzo.',
  'Que María acompañe a tu familia y llene de paz tu hogar.',
  'La constancia transforma los pequeños pasos en un camino.',
  'Escuchar con atención es otra manera de servir.',
  'Que tus decisiones nazcan de la paz y de un corazón generoso.',
  'Celebra lo que has avanzado, aunque todavía falte camino.',
  'Siempre hay algo bueno que podemos ofrecer a los demás.',
  'Pedir ayuda también es una forma de seguir adelante.',
  'Que el cansancio encuentre descanso y la preocupación encuentre consuelo.',
  'Un día difícil no borra todo lo bueno que has construido.',
  'La esperanza también se cultiva con acciones pequeñas.',
  'Que tu trabajo sea sustento, encuentro y servicio.',
  'Agradece el pan de hoy y comparte cuando puedas.',
  'La bondad no necesita grandes ocasiones.',
  'Que San José inspire tu trabajo paciente y el cuidado de los tuyos.',
  'Puedes volver a empezar con lo que sabes ahora.',
  'Trata a cada persona con el respeto que quisieras recibir.',
  'En medio de las tareas, guarda un momento para respirar y agradecer.',
  'Que la alegría de servir te acompañe durante el día.',
  'Lo que haces con cuidado habla de lo que llevas en el corazón.',
  'Confía en Dios mientras sigues poniendo de tu parte.',
  'La paz también se construye con palabras amables.',
  'Que hoy puedas reconocer una bendición que ayer pasó desapercibida.',
  'Los buenos frutos necesitan raíces, cuidado y tiempo.',
  'Sé paciente contigo. Aprender también forma parte del trabajo.',
  'Que tu hogar sea refugio y tu trabajo una oportunidad para crecer.',
  'La generosidad empieza por estar disponible para alguien.',
  'Lleva contigo lo aprendido y deja espacio para lo nuevo.',
  'Que el amor de Dios te recuerde que tu valor va más allá de tus resultados.',
  'Un comienzo humilde puede guardar una historia hermosa.',
  'Que hoy haya espacio para el trabajo, el descanso y quienes amas.',
  'Cada encuentro es una oportunidad de tratar bien a alguien.',
  'Termina el día agradeciendo también lo que pudiste aprender.',
]
export function nextReflection(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  random = Math.random,
) {
  const key = 'lcp.reflections.v1'
  let seen: number[] = []
  try {
    const value: unknown = JSON.parse(storage.getItem(key) ?? '[]')
    if (Array.isArray(value))
      seen = [
        ...new Set(
          value.filter(
            (n): n is number =>
              Number.isInteger(n) && n >= 0 && n < reflections.length,
          ),
        ),
      ]
  } catch {
    /* Storage unavailable or old data; still show a reflection. */
  }
  const last = seen.at(-1)
  if (seen.length >= reflections.length) seen = []
  const choices = reflections
    .map((_, index) => index)
    .filter((index) => !seen.includes(index) && index !== last)
  const selected =
    choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]
  try {
    storage.setItem(key, JSON.stringify([...seen, selected]))
  } catch {
    /* Works without persistence. */
  }
  return reflections[selected]
}
