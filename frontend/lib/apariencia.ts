/**
 * Apariencia elegida por el usuario: tema, color principal, tipografía,
 * tamaño de letra y modo compacto.
 *
 * Se aplica poniendo atributos en <html> (data-tema, data-fuente...) que
 * globals.css usa para cambiar las variables de color y la fuente.
 * Además se guarda una copia en localStorage para aplicarla apenas carga la
 * página (ver el script en app/layout.tsx), antes de pedirla a la API.
 */

export type Tema = 'oscuro' | 'medianoche' | 'claro' | 'bosque' | 'atardecer'
export type Fuente = 'geist' | 'inter' | 'nunito' | 'lora' | 'space-grotesk' | 'atkinson' | 'mono'

export type Preferencias = {
  tema: Tema
  color_primario: string
  fuente: Fuente
  tamanio_fuente: number
  compacto: boolean
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  tema: 'oscuro',
  color_primario: '#ff6b5b',
  fuente: 'geist',
  tamanio_fuente: 16,
  compacto: false,
}

export const CLAVE_APARIENCIA = 'kort_apariencia'

export const TEMAS: { id: Tema; nombre: string; colores: [string, string, string] }[] = [
  { id: 'oscuro', nombre: 'Oscuro', colores: ['#15161c', '#1d1f27', '#ecedef'] },
  { id: 'medianoche', nombre: 'Medianoche', colores: ['#0b0d17', '#12152a', '#e6e8f5'] },
  { id: 'claro', nombre: 'Claro', colores: ['#f6f7f9', '#ffffff', '#1b1e27'] },
  { id: 'bosque', nombre: 'Bosque', colores: ['#0f1712', '#16211a', '#e6efe8'] },
  { id: 'atardecer', nombre: 'Atardecer', colores: ['#1a1216', '#24181e', '#f3e9ec'] },
]

export const FUENTES: { id: Fuente; nombre: string }[] = [
  { id: 'geist', nombre: 'Geist (por defecto)' },
  { id: 'inter', nombre: 'Inter' },
  { id: 'nunito', nombre: 'Nunito (redondeada)' },
  { id: 'space-grotesk', nombre: 'Space Grotesk' },
  { id: 'lora', nombre: 'Lora (con serifa)' },
  { id: 'atkinson', nombre: 'Atkinson (muy legible)' },
  { id: 'mono', nombre: 'Monoespaciada' },
]

export const COLORES_SUGERIDOS = ['#ff6b5b', '#3d9be8', '#3fb68b', '#e8a33d', '#d9667f', '#7c5cff', '#4fb3bf', '#f472b6']

/** Texto oscuro o claro según cuán claro es el color de fondo (para que se lea bien). */
export function colorDeTextoSobre(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminancia > 0.35 ? '#15161c' : '#ffffff'
}

export function aplicarApariencia(p: Preferencias) {
  const html = document.documentElement
  html.dataset.tema = p.tema
  html.dataset.fuente = p.fuente
  html.dataset.compacto = p.compacto ? 'true' : 'false'
  const textoPrimario = colorDeTextoSobre(p.color_primario)
  html.style.setProperty('--primary', p.color_primario)
  html.style.setProperty('--primary-foreground', textoPrimario)
  html.style.fontSize = `${p.tamanio_fuente}px`
  try {
    window.localStorage.setItem(CLAVE_APARIENCIA, JSON.stringify({ ...p, texto_primario: textoPrimario }))
  } catch {
    // Sin localStorage (modo privado): se aplica igual, solo que no se recuerda.
  }
}

/** Script que corre antes de pintar la página: aplica la última apariencia conocida. */
export const SCRIPT_APARIENCIA_INICIAL = `(function(){try{var p=JSON.parse(localStorage.getItem('${CLAVE_APARIENCIA}')||'null');if(!p)return;var h=document.documentElement,c=/^#[0-9a-fA-F]{6}$/;h.dataset.tema=p.tema;h.dataset.fuente=p.fuente;h.dataset.compacto=p.compacto?'true':'false';if(c.test(p.color_primario)&&c.test(p.texto_primario)){h.style.setProperty('--primary',p.color_primario);h.style.setProperty('--primary-foreground',p.texto_primario)}var t=Number(p.tamanio_fuente);if(t>=12&&t<=20)h.style.fontSize=t+'px'}catch(e){}})()`
