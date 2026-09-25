export default function FieldOfficerHome() {
  const assignments = [
    { id: '1', title: 'Evacuate flooded area', priority: 'High', location: 'Downtown', ETA: '15 mins' },
    { id: '2', title: 'Deliver food supplies', priority: 'Medium', location: 'North Shelter', ETA: '30 mins' },
  ];
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Assignments</h1>
      <div className="space-y-4">
        {assignments.map(a => (
          <div key={a.id} className="p-4 border rounded shadow-sm flex justify-between items-center bg-white dark:bg-gray-800">
            <div>
              <h2 className="text-xl font-semibold">{a.title}</h2>
              <p className="text-gray-600 dark:text-gray-400">Location: {a.location}</p>
              <p className="text-sm text-gray-500">ETA: {a.ETA}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              a.priority === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {a.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
