import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Ed25519 Signature Verification for Discord ---
async function verifyDiscordSignature(req: Request, body: string): Promise<boolean> {
  const PUBLIC_KEY = Deno.env.get('DISCORD_PUBLIC_KEY')
  if (!PUBLIC_KEY) {
    console.error('DISCORD_PUBLIC_KEY not set')
    return false
  }

  const signature = req.headers.get('x-signature-ed25519')
  const timestamp = req.headers.get('x-signature-timestamp')

  if (!signature || !timestamp) return false

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(PUBLIC_KEY),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    )

    const message = new TextEncoder().encode(timestamp + body)
    const sig = hexToUint8Array(signature)

    return await crypto.subtle.verify('Ed25519', key, sig, message)
  } catch (err) {
    console.error('Signature verification error:', err)
    return false
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

// --- Types ---
interface DiscordResponse {
  type: number
  data?: {
    content?: string
    embeds?: Array<{
      title?: string
      description?: string
      color?: number
      fields?: Array<{ name: string; value: string; inline?: boolean }>
      footer?: { text: string }
      timestamp?: string
      image?: { url: string }
    }>
    components?: Array<{
      type: number
      components: Array<{
        type: number
        label?: string
        style?: number
        custom_id?: string
        url?: string
        options?: Array<{ label: string; value: string; description?: string }>
        placeholder?: string
        min_values?: number
        max_values?: number
      }>
    }>
    attachments?: Array<{ id: string; filename: string }>
  }
}

// --- Supabase ---
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// --- Helpers ---
function createEmbed(title: string, description: string, color = 0x06b6d4, fields?: Array<{ name: string; value: string; inline?: boolean }>, imageUrl?: string) {
  const embed: any = {
    title, description, color,
    footer: { text: 'AFLV Operations Center' },
    timestamp: new Date().toISOString()
  }
  if (fields) embed.fields = fields
  if (imageUrl) embed.image = { url: imageUrl }
  return { embeds: [embed] }
}

function createButtons(buttons: Array<{ label: string; style: number; custom_id: string }>) {
  return {
    components: buttons.map(btn => ({
      type: 1,
      components: [{ type: 2, label: btn.label, style: btn.style, custom_id: btn.custom_id }]
    }))
  }
}

function createSelectMenu(customId: string, placeholder: string, options: Array<{ label: string; value: string; description?: string }>) {
  return {
    components: [{
      type: 1,
      components: [{ type: 3, custom_id: customId, placeholder, options, min_values: 1, max_values: 1 }]
    }]
  }
}

function getRankName(hours: number): string {
  if (hours < 100) return 'Cadet'
  if (hours < 300) return 'Junior First Officer'
  if (hours < 600) return 'First Officer'
  if (hours < 1000) return 'Senior First Officer'
  if (hours < 2000) return 'Captain'
  if (hours < 4000) return 'Senior Captain'
  return 'Fleet Captain'
}

// --- DB Helpers ---
async function findUserByDiscordId(supabase: any, discordId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('discord_id', discordId).single()
  return data
}

async function findUserByCallsign(supabase: any, callsign: string) {
  const { data } = await supabase.from('profiles').select('*').ilike('callsign', callsign).single()
  return data
}

async function getUserPIREPs(supabase: any, userId: string, limit = 10) {
  const { data } = await supabase.from('pireps').select('*').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(limit)
  return data || []
}

async function getUserStats(supabase: any, userId: string) {
  const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single()
  if (!profile) return null

  const { data: pireps } = await supabase
    .from('pireps')
    .select('flight_time_hrs, flight_time_mins, money_earned, status, submitted_at')
    .eq('user_id', userId).eq('status', 'approved').order('submitted_at', { ascending: true })

  const approvedPireps: any[] = pireps || []
  const totalFlights = approvedPireps.length
  const totalHours = approvedPireps.reduce((sum: number, p: any) => sum + (p.flight_time_hrs || 0) + ((p.flight_time_mins || 0) / 60), 0)
  const totalEarnings = approvedPireps.reduce((sum: number, p: any) => sum + (p.money_earned || 0), 0)

  return {
    profile,
    stats: { totalFlights, totalHours: totalHours.toFixed(1), totalEarnings, rank: getRankName(totalHours) },
    recentPIREPs: approvedPireps.slice(-30).map((p: any) => ({
      date: p.submitted_at,
      hours: ((p.flight_time_hrs || 0) + ((p.flight_time_mins || 0) / 60)).toFixed(1),
      earnings: p.money_earned || 0
    }))
  }
}

async function getActiveDispatch(supabase: any, userId: string) {
  const { data } = await supabase
    .from('dispatch_legs')
    .select(`id, leg_number, status, aircraft:aircraft(name, type_code, family), route:routes(flight_number, departure_airport, arrival_airport, distance_nm)`)
    .eq('user_id', userId).eq('status', 'assigned').order('assigned_at', { ascending: false }).limit(1).single()
  return data
}

async function getUserTypeRatings(supabase: any, userId: string) {
  const { data } = await supabase.from('type_ratings').select(`id, is_active, aircraft:aircraft(id, name, type_code, family, seats, price)`).eq('user_id', userId)
  return data || []
}

async function getAllAvailableAircraft(supabase: any) {
  const { data } = await supabase.from('aircraft').select('*').order('family')
  return data || []
}

async function processPayment(supabase: any, fromUserId: string, toCallsign: string, amount: number) {
  const { data: sender } = await supabase.from('profiles').select('*').eq('user_id', fromUserId).single()
  if (!sender) return { error: 'Sender not found' }
  if (sender.money < amount) return { error: 'Insufficient funds' }

  const { data: recipient } = await supabase.from('profiles').select('*').ilike('callsign', toCallsign).single()
  if (!recipient) return { error: 'Recipient not found' }
  if (recipient.user_id === fromUserId) return { error: 'Cannot pay yourself' }

  await supabase.from('profiles').update({ money: sender.money - amount }).eq('user_id', fromUserId)
  await supabase.from('profiles').update({ money: recipient.money + amount }).eq('user_id', recipient.user_id)

  return { success: true, sender, recipient, amount }
}

async function linkDiscordAccount(supabase: any, discordId: string, discordUsername: string, email: string) {
  const { data: authUser } = await supabase.auth.admin.listUsers()
  const user = authUser?.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) return { error: 'No account found with this email' }

  const { data: profile } = await supabase.from('profiles').select('id, discord_id, callsign').eq('user_id', user.id).single()
  if (!profile) return { error: 'Profile not found. Please sign up first at the Operations Panel.' }
  if (profile.discord_id && profile.discord_id !== discordId) return { error: 'This account is already linked to another Discord user' }

  await supabase.from('profiles').update({ discord_id: discordId, discord_username: discordUsername }).eq('user_id', user.id)
  return { success: true, callsign: profile.callsign }
}

async function getLeaderboard(supabase: any, limit = 10) {
  const { data } = await supabase.from('profiles').select('callsign, name, total_hours, total_flights, money').order('total_hours', { ascending: false }).limit(limit)
  return data || []
}

async function getFleetStatus(supabase: any) {
  const { data } = await supabase.from('virtual_fleet').select('*').order('tail_number').limit(20)
  return data || []
}

// --- Command Handler ---
async function handleCommand(interaction: any): Promise<DiscordResponse> {
  const supabase = getSupabase()
  const commandName = interaction.data?.name?.toLowerCase()
  const options = interaction.data?.options || []
  const discordId = interaction.member?.user?.id || ''

  const getOption = (name: string) => options.find((o: any) => o.name === name)?.value as string | undefined
  const user = discordId ? await findUserByDiscordId(supabase, discordId) : null

  switch (commandName) {
    case 'ping':
      return { type: 4, data: createEmbed('🏓 Pong!', 'AFLV Discord Bot is online and operational!', 0x22c55e) }

    case 'link': {
      const email = getOption('email')
      if (!email) return { type: 4, data: createEmbed('🔗 Link Account', 'Please provide your email: `/link email:pilot@aeroflot.ru`', 0xeab308) }
      const discordUsername = interaction.member?.user?.username || ''
      const result = await linkDiscordAccount(supabase, discordId, discordUsername, email)
      if (result.error) return { type: 4, data: createEmbed('❌ Error', result.error, 0xef4444) }
      return { type: 4, data: { ...createEmbed('✅ Account Linked!', `Your Discord account has been linked to **${email}**\n\nUse \`/profile\` to view your pilot profile!`, 0x22c55e), components: [] } }
    }

    case 'profile': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first using `/link email:your@email.com`', 0xeab308) }
      const stats = await getUserStats(supabase, user.user_id)
      if (!stats) return { type: 4, data: createEmbed('❌ Error', 'Could not load profile', 0xef4444) }
      return {
        type: 4,
        data: createEmbed('👤 Pilot Profile', `**${stats.profile.callsign}** - ${stats.profile.name}`, 0x06b6d4, [
          { name: 'Rank', value: stats.stats.rank, inline: true },
          { name: 'Flight Hours', value: `${stats.stats.totalHours}h`, inline: true },
          { name: 'Total Flights', value: stats.stats.totalFlights.toString(), inline: true },
          { name: 'Balance', value: `$${stats.profile.money?.toLocaleString() || 0}`, inline: true },
          { name: 'Base', value: stats.profile.base_airport || 'Not Set', inline: true },
          { name: 'Aircraft', value: stats.profile.active_aircraft_family || 'A320', inline: true }
        ])
      }
    }

    case 'my-dispatch': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first using `/link`', 0xeab308) }
      const dispatch = await getActiveDispatch(supabase, user.user_id)
      if (!dispatch) {
        const { data: careerRequest } = await supabase.from('career_requests').select('*').eq('user_id', user.user_id).eq('status', 'pending').single()
        if (careerRequest) return { type: 4, data: createEmbed('⏳ Career Request Pending', 'Your career request is awaiting admin approval.', 0xeab308) }
        const typeRatings = await getUserTypeRatings(supabase, user.user_id)
        const purchasedAircraft = typeRatings.map((tr: any) => tr.aircraft)
        if (purchasedAircraft.length === 0) return { type: 4, data: createEmbed('🎖️ No Active Dispatch', 'Purchase aircraft from the shop to start your career!', 0x3b82f6) }
        const activeRating = typeRatings.find((tr: any) => tr.is_active)
        const currentFamily = activeRating?.aircraft?.family || purchasedAircraft[0]?.family
        return {
          type: 4,
          data: {
            ...createEmbed('🎖️ Request Career', `Current Aircraft Family: **${currentFamily}**\n\nSelect an aircraft family to request a career dispatch:`, 0x3b82f6),
            ...createSelectMenu('select_aircraft_family', 'Select Aircraft Family', purchasedAircraft.map((ac: any) => ({ label: `${ac.name} (${ac.family})`, value: ac.id, description: `Price: $${ac.price?.toLocaleString()}` })))
          }
        }
      }
      return {
        type: 4,
        data: createEmbed('✈️ Active Dispatch', `**Leg ${dispatch.leg_number}** - ${dispatch.status}`, 0x22c55e, [
          { name: 'Flight', value: dispatch.route?.flight_number || 'N/A', inline: true },
          { name: 'Aircraft', value: dispatch.aircraft?.name || 'N/A', inline: true },
          { name: 'Route', value: `${dispatch.route?.departure_airport} → ${dispatch.route?.arrival_airport}`, inline: true },
          { name: 'Distance', value: `${dispatch.route?.distance_nm || 0} NM`, inline: true }
        ])
      }
    }

    case 'pirep': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first', 0xeab308) }
      const pireps = await getUserPIREPs(supabase, user.user_id, 5)
      if (pireps.length === 0) return { type: 4, data: createEmbed('📝 No PIREPs', 'You haven\'t submitted any PIREPs yet.', 0x3b82f6) }
      const fields = pireps.map((p: any) => ({
        name: `${p.flight_number} - ${p.departure_airport} → ${p.arrival_airport}`,
        value: `Time: ${p.flight_time_hrs}h ${p.flight_time_mins}m | Status: ${p.status} | Earned: $${p.money_earned?.toLocaleString() || 0}`,
        inline: false
      }))
      return { type: 4, data: createEmbed('📝 Recent PIREPs', 'Your last 5 flight reports:', 0x06b6d4, fields) }
    }

    case 'shop': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first', 0xeab308) }
      const aircraft = await getAllAvailableAircraft(supabase)
      const typeRatings = await getUserTypeRatings(supabase, user.user_id)
      const ownedIds = typeRatings.map((tr: any) => tr.aircraft.id)
      const available = aircraft.filter((ac: any) => !ownedIds.includes(ac.id))
      const owned = typeRatings.map((tr: any) => tr.aircraft)
      let description = `**Your Balance:** $${user.money?.toLocaleString() || 0}\n\n`
      if (owned.length > 0) {
        description += '**🛩️ Your Fleet:**\n'
        owned.forEach((ac: any) => {
          const isActive = typeRatings.find((tr: any) => tr.aircraft.id === ac.id && tr.is_active)
          description += `${isActive ? '✅' : '⚪'} ${ac.name} (${ac.family})\n`
        })
        description += '\n'
      }
      if (available.length > 0) {
        description += '**🛒 Available for Purchase:**\n'
        available.slice(0, 10).forEach((ac: any) => { description += `${ac.name} - $${ac.price?.toLocaleString()}\n` })
      }
      return {
        type: 4,
        data: {
          ...createEmbed('🛒 Aircraft Shop', description, 0x06b6d4),
          components: owned.length > 0 ? [{ type: 1, components: [{ type: 3, custom_id: 'set_active_aircraft', placeholder: 'Set Active Aircraft', options: owned.map((ac: any) => ({ label: ac.name, value: ac.id })) }] }] : []
        }
      }
    }

    case 'bank': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first', 0xeab308) }
      const stats = await getUserStats(supabase, user.user_id)
      if (!stats) return { type: 4, data: createEmbed('❌ Error', 'Could not load bank data', 0xef4444) }
      return {
        type: 4,
        data: {
          ...createEmbed('💰 Bank Account', `**Balance:** $${user.money?.toLocaleString() || 0}`, 0x22c55e, [
            { name: 'Total Earnings', value: `$${stats.stats.totalEarnings.toLocaleString()}`, inline: true },
            { name: 'Total Flights', value: stats.stats.totalFlights.toString(), inline: true },
            { name: 'Flight Hours', value: `${stats.stats.totalHours}h`, inline: true }
          ]),
          ...createButtons([{ label: '💸 Pay Pilot', style: 2, custom_id: 'pay_button' }])
        }
      }
    }

    case 'pay': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first', 0xeab308) }
      const callsign = getOption('callsign')
      const amount = parseInt(getOption('amount') || '0')
      if (!callsign || !amount) return { type: 4, data: createEmbed('💸 Payment', 'Usage: `/pay callsign:AFLV021 amount:10000`', 0xeab308) }
      const result = await processPayment(supabase, user.user_id, callsign, amount)
      if (result.error) return { type: 4, data: createEmbed('❌ Payment Failed', result.error, 0xef4444) }
      return { type: 4, data: createEmbed('✅ Payment Successful!', `Sent **$${amount.toLocaleString()}** to **${callsign}**\n\nYour new balance: $${(result.sender.money - amount).toLocaleString()}`, 0x22c55e) }
    }

    case 'leaderboard': {
      const leaderboard = await getLeaderboard(supabase)
      const fields = leaderboard.map((p: any, i: number) => ({
        name: `#${i + 1} ${p.callsign}`,
        value: `${p.total_hours?.toFixed(1) || 0}h | ${p.total_flights || 0} flights | $${p.money?.toLocaleString() || 0}`,
        inline: false
      }))
      return { type: 4, data: createEmbed('🏆 Leaderboard', 'Top pilots by flight hours:', 0xeab308, fields) }
    }

    case 'fleet': {
      const fleet = await getFleetStatus(supabase)
      if (fleet.length === 0) return { type: 4, data: createEmbed('✈️ Virtual Fleet', 'No aircraft in fleet', 0x3b82f6) }
      const fields = fleet.slice(0, 10).map((f: any) => ({
        name: f.tail_number,
        value: `${f.status} | ${f.current_location || 'Unknown'}`,
        inline: true
      }))
      return { type: 4, data: createEmbed('✈️ Virtual Fleet', 'Aircraft status:', 0x06b6d4, fields) }
    }

    case 'stats': {
      if (!user) return { type: 4, data: createEmbed('❌ Not Linked', 'Link your account first', 0xeab308) }
      const stats = await getUserStats(supabase, user.user_id)
      if (!stats) return { type: 4, data: createEmbed('❌ Error', 'Could not load statistics', 0xef4444) }
      return {
        type: 4,
        data: createEmbed('📊 Detailed Statistics', `For **${user.callsign}**`, 0x3b82f6, [
          { name: 'Total Hours', value: stats.stats.totalHours, inline: true },
          { name: 'Total Flights', value: stats.stats.totalFlights.toString(), inline: true },
          { name: 'Total Earnings', value: `$${stats.stats.totalEarnings.toLocaleString()}`, inline: true },
          { name: 'Current Balance', value: `$${user.money?.toLocaleString() || 0}`, inline: true },
          { name: 'Rank', value: stats.stats.rank, inline: true },
          { name: 'XP', value: (user.xp || 0).toString(), inline: true }
        ])
      }
    }

    case 'help':
      return {
        type: 4,
        data: createEmbed('📚 Command Help',
          '**Available Commands:**\n\n' +
          '`/link email:pilot@aeroflot.ru` - Link Discord to your pilot account\n' +
          '`/profile` - View your pilot profile\n' +
          '`/my-dispatch` - View active dispatch or request career\n' +
          '`/pirep` - View recent PIREPs\n' +
          '`/shop` - Browse and purchase aircraft\n' +
          '`/bank` - View balance\n' +
          '`/pay callsign:AFLV021 amount:10000` - Pay another pilot\n' +
          '`/leaderboard` - Top pilots\n' +
          '`/fleet` - Virtual fleet status\n' +
          '`/stats` - Detailed statistics\n' +
          '`/ping` - Bot status', 0x06b6d4)
      }

    default:
      return { type: 4, data: createEmbed('❓ Unknown Command', 'Use `/help` for available commands', 0xef4444) }
  }
}

// --- Component Interaction Handler ---
async function handleComponentInteraction(customId: string, discordId: string, values: string[]): Promise<DiscordResponse> {
  const supabase = getSupabase()
  const user = discordId ? await findUserByDiscordId(supabase, discordId) : null

  switch (customId) {
    case 'pay_button':
      return { type: 4, data: createEmbed('💸 Make Payment', 'Use `/pay callsign:AFLV021 amount:10000` to pay another pilot.', 0x3b82f6) }

    case 'select_aircraft_family': {
      if (!user) return { type: 4, data: createEmbed('❌ Error', 'Link your account first', 0xef4444) }
      await supabase.from('career_requests').insert({ user_id: user.user_id, status: 'pending' })
      return { type: 4, data: createEmbed('✅ Career Request Submitted!', 'Your career request has been submitted for review!', 0x22c55e) }
    }

    case 'set_active_aircraft': {
      if (!user) return { type: 4, data: createEmbed('❌ Error', 'Link your account first', 0xef4444) }
      const aircraftId = values[0]
      await supabase.from('type_ratings').update({ is_active: false }).eq('user_id', user.user_id)
      await supabase.from('type_ratings').update({ is_active: true }).eq('user_id', user.user_id).eq('aircraft_id', aircraftId)
      return { type: 4, data: createEmbed('✅ Active Aircraft Updated!', 'Your active aircraft has been changed.', 0x22c55e) }
    }

    default:
      return { type: 4, data: createEmbed('❓ Unknown', 'Action not recognized', 0xef4444) }
  }
}

// --- Main Handler with Signature Verification ---
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Read body as text first for signature verification
    const body = await req.text()

    // Verify Discord signature
    const isValid = await verifyDiscordSignature(req, body)
    if (!isValid) {
      console.error('Invalid Discord signature')
      return new Response(JSON.stringify({ error: 'Invalid request signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const interaction = JSON.parse(body)

    // Type 1: PING (Discord verification handshake)
    if (interaction.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Type 3: Component interaction (buttons, selects)
    if (interaction.type === 3) {
      const customId = interaction.data?.custom_id || ''
      const discordId = interaction.member?.user?.id || ''
      const values = interaction.data?.values || []
      const response = await handleComponentInteraction(customId, discordId, values)
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Type 2: Application command (slash commands)
    if (interaction.type === 2) {
      const response = await handleCommand(interaction)
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown interaction type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
