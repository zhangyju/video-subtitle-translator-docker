export function handleErrors(error: unknown): Response {
  console.error('Error:', error);

  const errorResponse = {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
  };

  return new Response(JSON.stringify(errorResponse), {
    status: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
