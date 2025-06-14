
import React from "react";

// You can swap the Unsplash image ID for another from context if you prefer.
const imageUrl =
  "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=800&q=80";

const AuthGraphic: React.FC = () => (
  <div className="relative h-full w-full flex items-center justify-center bg-card overflow-hidden">
    <img
      src={imageUrl}
      alt="Workplace"
      className="absolute inset-0 w-full h-full object-cover object-center"
      draggable={false}
    />
    <div className="absolute inset-0 bg-primary/80 bg-blend-multiply" />
    <div className="relative z-10 p-12 flex flex-col items-center text-center">
      <h2 className="text-3xl md:text-4xl font-bold text-card-foreground drop-shadow mb-4 tracking-tight">
        Welcome to Your Enterprise Portal
      </h2>
      <p className="text-base md:text-lg text-card-foreground/80 max-w-md leading-relaxed">
        Secure, powerful access for your team. <br />
        Please sign in to continue.
      </p>
    </div>
  </div>
);

export default AuthGraphic;
