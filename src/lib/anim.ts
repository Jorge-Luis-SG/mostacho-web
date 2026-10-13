/**
 * Animaciones con el scroll. Cada sección elige la suya en site.json → "anim".
 * Solo se activan en escritorio (≥ 900 px) y si el usuario no pidió reducir el movimiento;
 * si no, la página se ve exactamente igual que sin ellas.
 */
export type AnimMode =
  | 'mask' // Inicio: la fiesta se ve a través del bigote, que crece hasta llenar la pantalla
  | 'guide' // Nosotros: el bigote sale de detrás de la foto y baja hasta Servicios
  | 'slide' // Tarjetas que avanzan con el scroll (el bigote guía baja por detrás)
  | 'ring' // Banners a pantalla completa: el que se va se retira al fondo y el siguiente entra por encima
  | 'doors' // Cada diapositiva se abre como una puerta doble
  | 'deal' // Las tarjetas se reparten volteándose
  | 'spotlight' // Una fila que se recorre entera; la del centro se ilumina
  | 'pop' // Letras que rebotan y la siguiente diapositiva se abre en círculo
  | 'tunnel' // Cada foto viene hacia ti y sigue de largo
  | 'sides'; // Las reseñas entran desde los lados

/** Largo (en vh) del tramo en el que la sección se queda fija mientras se anima. Sin valor = no se fija. */
export function pinLength(mode: AnimMode | undefined, count = 0): number | undefined {
  switch (mode) {
    case 'mask': return 200;
    case 'guide': return 180;
    // De un elemento a otro: un tramo corto por elemento (cada uno se queda quieto un momento)
    case 'slide': return 260;
    case 'ring':
    case 'doors':
    case 'spotlight': return 100 + count * 32;
    // Un tramo por carta (salen de una en una), más uno para la baraja y otro al final
    case 'deal': return 100 + (count + 2) * 35;
    case 'pop': return 200;
    case 'tunnel': return 100 + count * 30;
    default: return undefined;
  }
}
