
import { useNavigate } from "react-router-dom";



const services = [
  {
    title: "Repair",
    description: "Quick and reliable repair services for your home appliances.",
    icon: (
      <svg
        className="w-8 h-8 text-blue-400 mx-auto"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 7v6a2 2 0 002 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6"
        ></path>
      </svg>
    ),
  },
];

function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 w-full">
      {/* Hero Section */}
      <header className="flex flex-col items-center justify-center text-center py-12 px-4 w-full bg-gradient-to-br from-[#0a174e] via-[#161f39] to-[#2088b9]">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-3 text-white drop-shadow-lg">
          Find Trusted Local Services
        </h1>
        <p className="text-lg font-medium text-white mb-7 opacity-95">
          Powered by AI for fast and accurate matching
        </p>
        
      </header>

      {/* Popular Services */}
      <section className="w-full max-w-3xl mx-auto px-4 py-8">
        <h2 className="text-center text-2xl md:text-3xl font-bold mb-7 text-blue-900">
          Popular Services
        </h2>
        <div className="grid grid-cols-1 gap-6">
          {services.map(({ title, description, icon }) => (
            <div
              key={title}
              className="bg-white rounded-lg shadow p-6 flex flex-col items-center text-center border-t-4 border-blue-400 cursor-pointer transition transform hover:scale-105 hover:shadow-2xl"
            >
              <div className="mb-3">{icon}</div>
              <h3 className="text-md font-bold mb-2 text-blue-900">{title}</h3>
              <p className="text-gray-700 mb-4">{description}</p>
              <button
                className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-800 transition shadow transform hover:scale-110"
                onClick={() => navigate("/signup")}
              >
                FIND PROVIDERS
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Worker Application Section at Bottom */}
      <section className="w-full max-w-3xl mx-auto px-4 py-10">
        <div
          className="bg-gradient-to-r from-[#0a174e] via-[#161f39] to-[#1a213a] rounded-lg shadow-lg p-8 flex flex-col items-center text-center cursor-pointer transition transform hover:scale-105 hover:shadow-2xl"
          onClick={() => navigate("/worker-application")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/worker-application");
          }}
        >
          <div className="mb-4">
            <svg
              className="w-12 h-12 text-blue-400 mx-auto"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="8" r="4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 20v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
            </svg>
          </div>
          <h3 className="text-blue-200 text-xl font-bold mb-2 drop-shadow select-none">
            Join As a Service Provider
          </h3>
          <p className="text-blue-100 mb-6 max-w-md select-none">
            Want to help others and offer your skills?
            <br />
            Click here to apply and become a worker!
          </p>
          <button className="bg-blue-700 text-white font-extrabold rounded-md px-6 py-3 shadow-md hover:bg-blue-800 transition transform hover:scale-110">
            Worker Application
          </button>
        </div>
      </section>

      
        
    </div>
  );
}

// ChatbotModal component code here (imported or defined above)

export default HomePage;
