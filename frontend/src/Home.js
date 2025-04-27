export default function Home({ user }) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl mb-4">Welcome {user?.name || 'Guest'}</h1>
        {user?.photo && <img src={user.photo} alt="User" className="rounded-full w-24 h-24" />}
        <p className="mt-4">{user?.email}</p>
      </div>
    );
  }
  