// Deterministic daily wisdom rotation.
// Uses day-of-year so all users in the same region see the same quote.
// Pulls from the elder's wisdom array + an extended regional proverb library.

import { Elder } from '../../types/elder';

// Extra proverbs keyed by elder region — supplements the base elder.wisdom[]
const REGIONAL_PROVERBS: Record<string, string[]> = {
  westAfrica: [
    '"Àgbàlagbà tó fojú di ọ̀rẹ́ẹ̀ rẹ̀, ó fẹ́sẹ̀ di ọ̀tá." — An elder who ignores a friend courts an enemy.',
    '"Ọmọdé gbọ́n, àgbà gbọ́n, là fi dá Ilé-Ifẹ̀." — The young are wise, the old are wise — that is how civilizations rise.',
    'When the drumbeat changes, the dance must follow.',
    '"Bí inú bá bàjẹ́, ojú a di pupa." — When the belly aches, the eyes turn red.',
    'The hen that crows at the right time lives longest in the village.',
    'Before you count another man\'s harvest, plant your own seed.',
    '"Ruwanka ba ka biya ba, kwana guda bai wadatar da sha ba." — Debts unpaid grow heavier than mountains.',
    'No matter how long the night, the dawn will break.',
    'The palm tree grows slowly but shelters many.',
    'A single hand cannot tie a bundle.',
  ],
  eastAfrica: [
    '"Haraka haraka haina baraka." — Hurry hurry has no blessing.',
    '"Umoja ni nguvu, utengano ni udhaifu." — Unity is strength, division is weakness.',
    '"Mwacha mila ni mtumwa." — One who abandons their culture is a slave.',
    '"Haba na haba hujaza kibaba." — Little by little fills the measure.',
    'A spider\'s web united can tie a lion.',
    '"Asiyefunzwa na mamaye hufunzwa na ulimwengu." — Not taught by mother, taught by the world.',
    '"Mstahimilivu hula mbivu." — The patient one eats ripe fruit.',
    'If you want to go fast, go alone. If you want to go far, go together.',
    '"Akili ni mali." — Intelligence is wealth.',
    '"Penye nia pana njia." — Where there is will, there is a way.',
  ],
  southernAfrica: [
    '"Umuntu ngumuntu ngabantu." — A person is a person through other persons.',
    '"Indlela ibuzwa kwabaphambili." — The way forward is asked from those who went before.',
    '"Izandla ziyagezana." — Hands wash each other.',
    '"Motho ke motho ka batho." — A person is a person because of people.',
    'Sticks in a bundle are unbreakable.',
    '"Akukho ndlela engenampambuko." — There is no road without a turning.',
    '"Intaba ayihlangani nentaba, kodwa abantu bayahlangana." — Mountains never meet, but people do.',
    'Even the greatest warrior was once a child who tripped on stones.',
    '"Botho ke thuto e sa feleng." — Humanity is an endless lesson.',
    'Tomorrow belongs to those who prepare for it today.',
  ],
  latinAmerica: [
    '"El que madruga, Dios lo ayuda." — God helps those who rise early.',
    '"Más vale pájaro en mano que cien volando." — A bird in hand is worth a hundred flying.',
    '"Camarón que se duerme, se lo lleva la corriente." — The sleeping shrimp gets swept away.',
    '"Poco a poco se va lejos." — Little by little one goes far.',
    '"Ama sua, ama llulla, ama quella." — Do not steal, do not lie, do not be lazy.',
    'The earth does not belong to us; we belong to the earth — Pachamama teaches this.',
    '"Dime con quién andas y te diré quién eres." — Tell me who you walk with.',
    'Even the llama knows when to stop climbing.',
    '"No hay mal que por bien no venga." — No bad from which good does not come.',
    'The Andes have seen empires rise and fall. Patience outlasts them all.',
  ],
  southAsia: [
    '"कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।" — You have the right to work, not to its fruits.',
    '"सत्यमेव जयते।" — Truth alone triumphs.',
    '"बूँद बूँद से सागर भरता है।" — Drop by drop, the ocean fills.',
    '"विद्या धनम् सर्व धन प्रधानम्।" — Knowledge is the supreme wealth.',
    'The lotus blooms in muddy water — beauty rises from struggle.',
    '"জহাঁ চাহ, ভহাঁ রাহ।" — Where there is a will, there is a way.',
    'An arrow can only be shot by pulling it backward.',
    '"अहिंसा परमो धर्म:।" — Non-violence is the highest duty.',
    'One who sees the banyan tree in the seed has true vision.',
    'Like the monsoon, fortune comes to those who prepare the soil.',
  ],
  southeastAsia: [
    '"Ang hindi marunong lumingon sa pinanggalingan ay hindi makararating sa paroroonan." — Look back to move forward.',
    '"Nasa Diyos ang awa, nasa tao ang gawa." — Mercy is with God, effort is with people.',
    '"Có công mài sắt, có ngày nên kim." — Persistence grinds iron into needles.',
    'Bayanihan: many hands carry the house, many minds build the future.',
    '"Kapag may tiyaga, may nilaga." — With patience, there will be stew.',
    'The bamboo that bends is stronger than the oak that resists.',
    '"Matibay ang walis, palibhasa\'y magkabigkis." — The broom is strong because its strands are bound.',
    'A single grain of rice can tip the scale.',
    '"Đi một ngày đàng, học một sàng khôn." — Travel one day, learn a basket of wisdom.',
    'The firefly does not compete with the sun; each has its time to shine.',
  ],
  mena: [
    '"الصبر مفتاح الجنة." — Patience is the key to paradise.',
    '"من جدّ وجد." — He who strives shall find.',
    '"العلم نور والجهل ظلام." — Knowledge is light, ignorance is darkness.',
    '"الوقت كالسيف إن لم تقطعه قطعك." — Time is a sword; if you don\'t cut it, it cuts you.',
    'Trust in God, but tie your camel.',
    '"إذا هبّت رياحك فاغتنمها." — When your winds blow, seize the opportunity.',
    '"اطلب العلم من المهد إلى اللحد." — Seek knowledge from cradle to grave.',
    'The desert teaches patience; the oasis teaches gratitude.',
    '"ید خدا با جماعت است." — The hand of God is with the community.',
    'The bazaar rewards the trader who listens more than speaks.',
  ],
  caribbean: [
    '"Dèyè mòn, gen mòn." — Behind mountains, there are mountains.',
    '"Piti piti zwazo fè nich li." — Little by little the bird builds its nest.',
    '"Ravèt pa janm gen rezon devan poul." — The cockroach is never right before the chicken.',
    'Emancipate yourself from mental slavery — none but ourselves can free our minds.',
    '"Tout moun se moun." — Every person is a person.',
    'The coconut tree bends but never breaks in the hurricane.',
    'Steel drum don\'t play itself. You must work for the music.',
    '"Bouche manje tout manje, men li pa pale tout pawòl." — The mouth eats all food but speaks not all words.',
    'The reggae bass is the heartbeat of the islands — follow the rhythm of truth.',
    '"Fòk ou leve bonè pou ou devanse solèy." — Rise early to outrun the sun.',
  ],
  pacific: [
    '"He aha te mea nui o te ao? He tangata." — What matters most? It is people.',
    '"Kia kaha, kia māia, kia manawanui." — Be strong, be brave, be steadfast.',
    '"O le ala i le pule o le tautua." — The path to authority is through service.',
    '"Ahakoa he iti, he pounamu." — Although small, it is precious.',
    'The navigator who reads the stars never fears the dark sea.',
    '"Whāia te iti kahurangi." — Seek the treasure you value most dearly.',
    'The coral reef is built by creatures too small to see.',
    '"E lele le toloa ae ma\'au le lupe." — The wild duck flies but the pigeon stays.',
    'Tides come and go, but the island endures.',
    '"Mā te wā." — In the fullness of time.',
  ],
};

// deterministic index from date — same quote all day, rotates at midnight UTC
function dayIndex(poolSize: number): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - startOfYear.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % poolSize;
}

export function getDailyWisdom(elder: Elder): string {
  const extra = REGIONAL_PROVERBS[elder.region] ?? [];
  const pool = [...elder.wisdom, ...extra];
  if (pool.length === 0) return 'Wisdom is earned through patience.';
  return pool[dayIndex(pool.length)];
}

export function getRegionalProverbs(region: string): string[] {
  return REGIONAL_PROVERBS[region] ?? [];
}
