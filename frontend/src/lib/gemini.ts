const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

export interface ServiceBreakdownInput {
  service_name: string
  service_type: 'loan' | 'insurance' | 'savings'
  amount?: number
  interest_rate?: number
  premium_amount?: number
  repayment_days?: number
  coverage_amount?: number
  min_pulse_score?: number
  user_pulse_score?: number
  user_role: 'trader' | 'job_seeker'
}

export const getServiceBreakdown = async (
  service: ServiceBreakdownInput
): Promise<string> => {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(service) }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 250,
      },
    }),
  })

  if (!response.ok) throw new Error('Failed to get AI breakdown')

  const data = await response.json()
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text ||
    'Could not generate breakdown.'
  )
}

const buildPrompt = (service: ServiceBreakdownInput): string => {
  const who =
    service.user_role === 'job_seeker'
      ? 'a young Nigerian gig worker or job seeker looking for daily work'
      : 'a Nigerian informal market trader who buys and sells goods'

  const details = buildDetails(service)

  return `
You are a friendly, plain-speaking financial helper on a Nigerian app called Zovu.
You are talking to ${who}.
They are about to apply for the following service and want to understand it properly before they do.

${details}

Explain this to them in simple everyday Nigerian English — like a trusted older sibling explaining something at the market.
Do NOT use financial jargon. No big grammar.
Cover these 3 things in 3 short paragraphs:
1. What this service actually is and what it does for them
2. How they personally benefit — be specific with the numbers
3. One honest tip or thing they should watch out for

Keep it warm, encouraging, and real. Write in second person ("you", "your").
  `.trim()
}

const buildDetails = (service: ServiceBreakdownInput): string => {
  if (service.service_type === 'loan') {
    return `
Service type: Loan
Service name: ${service.service_name}
Amount they can borrow: ₦${service.amount?.toLocaleString('en-NG')}
Interest rate: ${service.interest_rate}% per month
Repayment period: ${service.repayment_days} days
Their current Zovu Pulse Score: ${service.user_pulse_score}
Minimum Pulse Score required to apply: ${service.min_pulse_score}
    `.trim()
  }

  if (service.service_type === 'insurance') {
    return `
Service type: Insurance
Service name: ${service.service_name}
Monthly cost to them: ₦${service.premium_amount?.toLocaleString('en-NG')}
What they are covered for: up to ₦${service.coverage_amount?.toLocaleString('en-NG')}
Their current Zovu Pulse Score: ${service.user_pulse_score}
Minimum Pulse Score required: ${service.min_pulse_score}
    `.trim()
  }

  if (service.service_type === 'savings') {
    return `
Service type: Savings
Service name: ${service.service_name}
Their current Zovu Pulse Score: ${service.user_pulse_score}
Minimum Pulse Score required: ${service.min_pulse_score}
    `.trim()
  }

  return `Service: ${service.service_name}`
}
