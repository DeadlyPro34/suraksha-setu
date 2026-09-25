export default function MissionDetail({ params }: { params: { id: string } }) {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Mission Detail - {params.id}</h1>
      <div className="border rounded-lg p-6 shadow-sm space-y-6 bg-white dark:bg-gray-800">
        <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 mb-4">
          [Photos Placeholder]
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="block text-sm text-gray-500">Severity</span>
            <span className="font-semibold text-lg text-red-600">High</span>
          </div>
          <div>
            <span className="block text-sm text-gray-500">People Affected</span>
            <span className="font-semibold text-lg">~50</span>
          </div>
        </div>
        <div className="pt-4 border-t">
          <span className="block text-sm text-gray-500 mb-2">Notes</span>
          <p className="text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-4 rounded-md">
            Water level is rising rapidly. Needs immediate evacuation boats and medical support.
          </p>
        </div>
      </div>
    </div>
  );
}
