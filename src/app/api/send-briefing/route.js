import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { generateDailyBriefing, generateAISummary, generateStrategicInsight } from '@/utils/briefingGenerator'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { userId } = await request.json()

    // Get user info
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userName = user.user_metadata?.full_name?.split(' ')[0] || 'there'
    const userEmail = user.email

    // Generate briefing data
    const briefingData = await generateDailyBriefing(userId)

    // Generate AI summary
    const aiSummary = await generateAISummary(briefingData, userName)
    const strategicInsight = await generateStrategicInsight(briefingData, userName)

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #B89A5A 0%, #9B8049 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #F7F5EF; padding: 30px; border-radius: 0 0 10px 10px; }
          .section { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #B89A5A; }
          .section h3 { margin-top: 0; color: #B89A5A; }
          .task-list { list-style: none; padding: 0; }
          .task-item { padding: 10px; margin: 8px 0; background: #F7F5EF; border-radius: 5px; }
          .urgent { border-left: 3px solid #DC2626; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌅 Good Morning, ${userName}!</h1>
            <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div class="content">
            <div class="section">
            <h3>🤖 AI Daily Summary</h3>
            <div style="background: linear-gradient(135deg, #F7F5EF 0%, #fff 100%); padding: 15px; border-radius: 8px; border-left: 4px solid #B89A5A; margin-bottom: 15px;">
              <p style="margin: 0; color: #333; line-height: 1.6;">
                ${aiSummary || 'Analyzing your schedule...'}
              </p>
            </div>
            
            ${strategicInsight ? `
            <div style="background: linear-gradient(135deg, #FFF9E6 0%, #fff 100%); padding: 15px; border-radius: 8px; border-left: 4px solid #9B8049;">
              <p style="margin: 0; font-size: 13px; color: #555;">
                <strong style="color: #B89A5A;">💡 Strategic Insight:</strong><br>
                ${strategicInsight}
              </p>
            </div>
            ` : ''}
          </div>

            ${briefingData.overdue.length > 0 ? `
            <div class="section urgent">
              <h3>⚠️ Overdue Items (${briefingData.overdue.length})</h3>
              <ul class="task-list">
                ${briefingData.overdue.map(d => `
                  <li class="task-item">
                    <strong>${d.title}</strong><br>
                    ${d.transactions.property_address} - ${d.transactions.clients.name}
                  </li>
                `).join('')}
              </ul>
            </div>` : ''}

            ${briefingData.today.length > 0 ? `
            <div class="section">
              <h3>🎯 Today's Priorities (${briefingData.today.length})</h3>
              <ul class="task-list">
                ${briefingData.today.map(d => `
                  <li class="task-item">
                    <strong>${d.title}</strong><br>
                    ${d.transactions.property_address} - ${d.transactions.clients.name}
                  </li>
                `).join('')}
              </ul>
            </div>` : `
            <div class="section">
              <h3>✅ No Deadlines Today!</h3>
              <p>You're all caught up. Great job! Focus on nurturing leads or preparing for tomorrow.</p>
            </div>`}

            ${briefingData.tomorrow.length > 0 ? `
            <div class="section">
              <h3>📅 Tomorrow's Tasks (${briefingData.tomorrow.length})</h3>
              <ul class="task-list">
                ${briefingData.tomorrow.map(d => `
                  <li class="task-item">
                    <strong>${d.title}</strong><br>
                    ${d.transactions.property_address} - ${d.transactions.clients.name}
                  </li>
                `).join('')}
              </ul>
            </div>` : ''}

            <div class="section">
              <h3>📊 Quick Stats</h3>
              <p><strong>Active Deals:</strong> ${briefingData.activeDealsCount}</p>
              <p><strong>Today's Tasks:</strong> ${briefingData.today.length}</p>
              <p><strong>Tomorrow's Tasks:</strong> ${briefingData.tomorrow.length}</p>
            </div>
          </div>

          <div class="footer">
            <p>Powered by Aureum CRM | <a href="http://localhost:3000/dashboard">View Dashboard</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    // Send email
    const { data, error } = await resend.emails.send({
      from: 'Aureum CRM <onboarding@resend.dev>',
      to: [userEmail],
      subject: `🌅 Daily Briefing - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html: emailHtml
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      emailId: data.id,
      preview: aiSummary 
    })

  } catch (error) {
    console.error('Briefing error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}