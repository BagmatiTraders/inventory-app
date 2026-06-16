const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

async function inspect() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Let's get the active sessions
    const { data: sessions, error: sessErr } = await supabase
        .from('daraz_chat_sessions')
        .select('*')
        .order('last_message_time', { ascending: false })
        .limit(5)

    if (sessErr) {
        console.error('Error fetching sessions:', sessErr)
        return
    }

    console.log('--- Last 5 Sessions ---')
    console.log(sessions)

    for (const session of sessions) {
        console.log(`\n--- Messages for Session: ${session.title} (${session.session_id}) ---`)
        const { data: messages, error: msgErr } = await supabase
            .from('daraz_chat_messages')
            .select('*')
            .eq('session_id', session.session_id)
            .order('send_time', { ascending: true })

        if (msgErr) {
            console.error('Error fetching messages:', msgErr)
            continue
        }

        console.table(messages.map(m => ({
            message_id: m.message_id,
            from_id: m.from_account_id,
            from_type: m.from_account_type,
            to_id: m.to_account_id,
            to_type: m.to_account_type,
            content: m.content.substring(0, 50),
            send_time: m.send_time
        })))
    }
}

inspect()
