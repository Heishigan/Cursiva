import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const apiKey = formData.get('apiKey') as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ error: "API key missing. Please complete Step 1 first." }, { status: 400 });
    }

    // Forward to the FastAPI backend with the API key in the header
    const backendForm = new FormData();
    backendForm.append('file', file);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/parse_pdf`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
      body: backendForm,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Backend error' }));
      return NextResponse.json({ error: err.detail || 'Parsing failed on backend' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { error: "Cannot reach the Cursiva backend. Please start the Python server on port 8000." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}
