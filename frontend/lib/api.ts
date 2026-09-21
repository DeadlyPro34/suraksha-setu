export const fetchApi = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, options);
  return res.json();
};
