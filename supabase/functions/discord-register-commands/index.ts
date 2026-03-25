const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const DISCORD_BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN')
  const DISCORD_APPLICATION_ID = Deno.env.get('DISCORD_APPLICATION_ID')

  if (!DISCORD_BOT_TOKEN || !DISCORD_APPLICATION_ID) {
    return new Response(JSON.stringify({ error: 'Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const commands = [
    { name: 'ping', description: 'Check if the bot is online' },
    { name: 'link', description: 'Link your Discord to your pilot account', options: [{ name: 'email', description: 'Your pilot account email', type: 3, required: true }] },
    { name: 'profile', description: 'View your pilot profile' },
    { name: 'my-dispatch', description: 'View your active dispatch or request a career' },
    { name: 'pirep', description: 'View your recent PIREPs' },
    { name: 'shop', description: 'Browse and manage aircraft' },
    { name: 'bank', description: 'View your bank balance' },
    { name: 'pay', description: 'Pay another pilot', options: [{ name: 'callsign', description: 'Recipient callsign', type: 3, required: true }, { name: 'amount', description: 'Amount to send', type: 4, required: true }] },
    { name: 'leaderboard', description: 'View top pilots' },
    { name: 'fleet', description: 'View virtual fleet status' },
    { name: 'stats', description: 'View detailed statistics' },
    { name: 'help', description: 'Show all available commands' },
  ]

  try {
    const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/commands`
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })

    const body = await res.json()
    return new Response(JSON.stringify({ status: res.status, registered: Array.isArray(body) ? body.length : 0, commands: body }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
