import React from 'react';
import { Navigate, useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  return (
    <div className='bg-gray-100'>
      <div className="max-w-4xl mx-auto p-6 sm:p-12 bg-gray-50 rounded-xl shadow-lg animate-fadeIn">
        <h1 className="text-3xl sm:text-4xl text-teal-600 text-left mt-12 mb-2 font-bold drop-shadow-md">Privacy Policy</h1>

        <div className='text-left text-gray-600 text-sm pb-2 border-b border-white/20'>
          <p><strong>Effective Date:</strong> 10/02/2025</p>
          <p><strong>Last Updated:</strong> 16/09/2025</p>
        </div>

        <div className="mt-5 text-gray-800 text-base leading-relaxed">
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <p className="text-justify">
              AR Experts Ltd ("we," "us," or "our"), registered at Centenary House, 1 Centenary Way, Salford, England, M50 1RF, trading as BIZALIGN, operates a CRM platform that connects with mobile devices and other digital services. This Privacy Policy outlines how we collect, use, protect, and manage personal data in compliance with UK GDPR, Data Protection Act 2018, and other relevant UK regulations.
            </p>
          </div>

          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">1. Introduction</h2>
            <p className="text-justify">
              This Privacy Policy applies to all users of the BIZALIGN platform, including website visitors, mobile app users, and customers who interact with our services. It explains how we handle personal data, the rights of users, and the measures we take to ensure data security and compliance with UK laws.
            </p>
            <p className="text-justify">
              BIZALIGN is a Customer Relationship Management (CRM) platform designed to help businesses manage their customer interactions, sales processes, and marketing activities. The platform integrates with mobile devices, third-party services, and other digital tools to provide a seamless experience for users.
            </p>
          </div>

          {/* 2. Information We Collect */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">2. Information We Collect</h2>
            <p className="text-justify">
              We collect various types of information to provide and improve our services. The data we collect can be categorized as follows:
            </p>

            <h3 className="text-xl text-green-600 mt-4">2.1 Personal Information</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Name, Email Address, Phone Number:</strong> Collected during account registration and profile updates.</li>
              <li className="mb-2"><strong>Company Details:</strong> Including company name, address, and industry sector.</li>
              <li className="mb-2"><strong>Title and Role:</strong> To tailor the platform experience to your professional needs.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">2.2 Financial Information</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Payment Details:</strong> Bank Account details, and billing addresses for processing payments.</li>
              <li className="mb-2"><strong>Invoicing Data:</strong> Transaction history, invoices, and payment receipts.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">2.3 Technical Data</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Device Information:</strong> Including device type, operating system, and unique device identifiers.</li>
              <li className="mb-2"><strong>IP Address:</strong> Collected for security and analytics purposes.</li>
              <li className="mb-2"><strong>Browser Type and Version:</strong> To ensure compatibility and optimize user experience.</li>
              <li className="mb-2"><strong>Usage Logs:</strong> Information about how you interact with the platform, including pages visited, features used, and time spent on the platform.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">2.4 Location Data</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Geolocation Data:</strong> Collected via app settings or user input to provide location-based services.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">2.5 Sensitive Information</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Tax Data:</strong> Including VAT numbers and other tax-related information for compliance purposes.</li>
              <li className="mb-2"><strong>Identity Verification Documents:</strong> Such as passports or driver's licenses, where legally required for KYC (Know Your Customer) processes.</li>
            </ul>

            {/* New: Image data collection */}
            <h3 className="text-xl text-green-600 mt-4">2.6 Image Data (Personnels)</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Vehicle Images:</strong> Photographs of the front, back, left, and right sides of the van for verification and reporting.</li>
              <li className="mb-2"><strong>Damage Images:</strong> Close-up images of dents, scratches, broken parts, or other damage to the vehicle.</li>
              <li className="mb-2"><strong>Accepted File Formats:</strong> JPEG (.jpeg), JPG (.jpg), and PNG (.png).</li>
            </ul>
          </div>

          {/* 3. How We Collect Information */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">3. How We Collect Information</h2>
            <p className="text-justify">
              We gather information through various methods, including:
            </p>

            <h3 className="text-xl text-green-600 mt-4">3.1 Direct Input</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Registration Forms:</strong> When you create an account on BIZALIGN.</li>
              <li className="mb-2"><strong>Profile Updates:</strong> When you update your personal or company information.</li>
              <li className="mb-2"><strong>User Interactions:</strong> Such as filling out forms, submitting queries, or participating in surveys, uploading Photos, documents.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">3.2 Automated Technologies</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Cookies:</strong> Small text files stored on your device to enhance user experience and track site usage.</li>
              <li className="mb-2"><strong>Log Files:</strong> Automatically collected data about your interactions with the platform.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">3.3 Third-Party Integrations</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Payment Gateways:</strong> APIs connecting third-party services such as payment gateways.</li>
              <li className="mb-2"><strong>APIs:</strong> Connecting third-party services like email marketing tools, CRM integrations, and other business applications.</li>
            </ul>

            {/* New: Image upload & processing flow */}
            <h3 className="text-xl text-green-600 mt-4">3.4 Image Upload and Processing Flow</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Personnel Uploads:</strong> Personnels upload images directly through the mobile app.</li>
              <li className="mb-2"><strong>Secure Storage:</strong> Images are securely uploaded to Amazon S3 (cloud storage).</li>
              <li className="mb-2"><strong>Metadata Creation:</strong> A reference and metadata record is created and stored in MongoDB for operational use.</li>
              <li className="mb-2"><strong>Third-Party Processing:</strong> Images are transmitted to Roboflow, our image processing provider, where they are analysed by our trained detection model for verification and validation.</li>
            </ul>
          </div>

          {/* 4. Use of Information */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">4. Use of Information</h2>
            <p className="text-justify">
              We use the collected information for the following purposes:
            </p>

            <h3 className="text-xl text-green-600 mt-4">4.1 Providing Services</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Account Setup and Management:</strong> To create and manage user accounts.</li>
              <li className="mb-2"><strong>Platform Functionality:</strong> To ensure the platform operates smoothly and efficiently.</li>
              <li className="mb-2"><strong>Customer Support:</strong> To assist users with any issues or queries.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">4.2 Compliance & Legal Obligations</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Regulatory Compliance:</strong> To meet obligations under UK GDPR and other relevant laws.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">4.3 Security</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Data Integrity:</strong> To protect against unauthorized access, data breaches, and other security threats.</li>
              <li className="mb-2"><strong>Fraud Prevention:</strong> To detect and prevent fraudulent activities.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">4.4 Communication</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Product Updates:</strong> To inform users about new features, updates, and improvements.</li>
              <li className="mb-2"><strong>Newsletters:</strong> To share industry news, tips, and promotional offers.</li>
              <li className="mb-2"><strong>Critical Notifications:</strong> To alert users about important changes or security issues.</li>
            </ul>

            {/* New: Image processing purposes */}
            <h3 className="text-xl text-green-600 mt-4">4.5 Image Verification and Analysis</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Verification:</strong> To confirm that submitted images are accurate, relevant, and meet reporting requirements.</li>
              <li className="mb-2"><strong>Damage and Vehicle Analysis:</strong> Using our Roboflow-trained model to detect vehicle parts (e.g., bumper, headlights, windshield) and assess damages.</li>
              <li className="mb-2"><strong>Fleet Operations:</strong> Storing analysis results in MongoDB to support reporting, vehicle monitoring, and fleet management decisions.</li>
            </ul>
            <p className="text-justify font-semibold">We do not use your images for advertising, marketing, or any purpose unrelated to verification and analysis.</p>
          </div>

          {/* 5. Sharing and Disclosure */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">5. Sharing and Disclosure of Information</h2>
            <p className="text-justify">
              We only share data as necessary for the following purposes:
            </p>

            <h3 className="text-xl text-green-600 mt-4">5.1 Cloud Storage Providers</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Amazon Web Services (AWS):</strong> For secure cloud-based data storage.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">5.2 Database Management</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>MongoDB:</strong> For structured storage and efficient data retrieval.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">5.3 Third-Party Analytics</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Firebase:</strong> For analytics and push notifications to improve user engagement.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">5.4 Legal Compliance</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Government Authorities:</strong> Where required by law, such as in response to a court order or regulatory request.</li>
            </ul>

            {/* New: Roboflow disclosure */}
            <h3 className="text-xl text-green-600 mt-4">5.5 Image Processing Provider</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Roboflow:</strong> We share images solely with Roboflow to process them on our behalf for verification and validation. Roboflow is contractually prohibited from retaining or using these images for independent purposes. We do not sell or share your data with advertisers or unrelated third parties.</li>
            </ul>
          </div>

          {/* 6. Data Security */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">6. Data Security</h2>
            <p className="text-justify">We implement robust security measures to protect your personal data:</p>

            <h3 className="text-xl text-green-600 mt-4">6.1 Encryption</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Data in Transit:</strong> All sensitive data is encrypted during transmission using SSL/TLS protocols.</li>
              <li className="mb-2"><strong>Data at Rest:</strong> Sensitive data stored in our databases (MongoDB) is encrypted using AES-256 encryption. Also, Backup data is stored in local hard drive.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">6.2 Access Control</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Role-Based Access:</strong> Data access is restricted based on user roles and responsibilities.</li>
              <li className="mb-2"><strong>Multi-Factor Authentication (MFA):</strong> To add an extra layer of security for account access.</li>
            </ul>

            <h3 className="text-xl text-green-600 mt-4">6.3 Monitoring</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Regular Audits:</strong> We conduct regular system audits to identify and address vulnerabilities.</li>
              <li className="mb-2"><strong>Incident Response:</strong> We have a dedicated incident response team to handle data breaches and security incidents.</li>
            </ul>

            {/* New: Image security specifics */}
            <h3 className="text-xl text-green-600 mt-4">6.4 Image Security and Third-Party Safeguards</h3>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Storage:</strong> Images are stored in Amazon S3 with encryption at rest; related metadata and analysis outputs are stored in MongoDB with controlled access.</li>
              <li className="mb-2"><strong>Transmission:</strong> Images are encrypted when uploaded via the app and when transmitted to Roboflow for processing.</li>
              <li className="mb-2"><strong>Access Control:</strong> Access to stored images is restricted to authorised personnel and systems only.</li>
              <li className="mb-2"><strong>Third-Party Security:</strong> Roboflow is contractually bound to maintain confidentiality and implement strong technical and organisational safeguards.</li>
            </ul>
          </div>

          {/* 7. Data Retention */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">7. Data Retention</h2>
            <p className="text-justify">
              We retain personal data for <strong>up to 6 years</strong>, as required by legal and regulatory obligations. Certain records may be retained longer if necessary to comply with law or to establish, exercise, or defend legal claims.
            </p>
            <p className="text-justify mt-3">
              <strong>Images and related metadata</strong> collected for verification and reporting are retained only for as long as necessary to fulfil those purposes. When no longer required, they are securely deleted or anonymised.
            </p>
          </div>

          {/* 8. Your Rights */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">8. Your Rights</h2>
            <p className="text-justify">Under UK law, you have the right to:</p>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Access and Correct:</strong> Request access to personal data and correct inaccuracies.</li>
              <li className="mb-2"><strong>Erasure:</strong> Request deletion of personal data, subject to legal obligations.</li>
              <li className="mb-2"><strong>Data Portability:</strong> Receive personal data in a structured format.</li>
              <li className="mb-2"><strong>Object to Processing:</strong> Oppose processing where applicable.</li>
            </ul>
            <p className="text-justify">
              To exercise these rights, contact <strong>admin@bizalign.co.uk</strong>.
            </p>
          </div>

          {/* 9. Cookie Policy */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">9. Cookie Policy</h2>
            <p className="text-justify">We use cookies to:</p>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2">Improve user experience.</li>
              <li className="mb-2">Track site usage through analytics tools.</li>
              <li className="mb-2">Personalise content.</li>
            </ul>
            <p className="text-justify">Users can manage cookie preferences through their browser settings or via our cookie consent banner.</p>
          </div>

          {/* 10. Legal Basis */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">10. Legal Basis for Processing</h2>
            <p className="text-justify">We process personal data based on:</p>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Contractual Necessity:</strong> Providing requested services.</li>
              <li className="mb-2"><strong>Legal Obligation:</strong> Compliance with applicable laws.</li>
              <li className="mb-2"><strong>Legitimate Interest:</strong> Improving services and ensuring security, including verification and fraud prevention relating to uploaded images.</li>
              <li className="mb-2"><strong>Consent:</strong> When required, such as for marketing purposes.</li>
            </ul>
          </div>

          {/* 11. Data Breach */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">11. Data Breach Notification</h2>
            <p className="text-justify">In the event of a data breach, we will:</p>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2">Notify affected users and the ICO (Information Commissioner's Office) within 72 hours, as required by law.</li>
            </ul>
          </div>

          {/* 12. Changes */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">12. Changes to this Privacy Policy</h2>
            <p className="text-justify">
              We may update this policy periodically. Updates will be posted on our website and significant changes will be communicated via email. It will also be updated on our website and in our app store listings.
            </p>
          </div>

          {/* 13. Children's Privacy */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">13. Children's Privacy</h2>
            <p className="text-justify">Our platform is not intended for users under the age of 16. We do not knowingly collect personal data from children.</p>
          </div>

          {/* 14. Third-Party Links */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">14. Third-Party Links</h2>
            <p className="text-justify">Our platform may contain links to third-party websites. We are not responsible for the privacy practices of these sites.</p>
          </div>

          {/* 15. Contact */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">15. Contact Information</h2>
            <p className="text-justify">For any privacy-related questions or concerns, contact us at:</p>
            <p className="text-justify">
              <strong>Email:</strong> <a href="mailto:admin@bizalign.co.uk" className="text-teal-600 hover:underline">admin@bizalign.co.uk</a><br />
              <strong>Address:</strong> Centenary House, 1 Centenary Way, Salford, England, M50 1RF<br />
              <strong>ICO Registration Number:</strong> ZB827459
            </p>
          </div>

          {/* 16. Third-Party Services (summary for image processing) */}
          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <h2 className="text-2xl text-teal-600 mb-4 font-bold">16. Third-Party Services (Image Processing)</h2>
            <p className="text-justify">We use the following third-party services to process images:</p>
            <ul className="ml-5 pl-2 list-disc">
              <li className="mb-2"><strong>Roboflow:</strong> Provides model training and image verification services exclusively on our behalf.</li>
              <li className="mb-2"><strong>Amazon Web Services (S3):</strong> Provides secure cloud storage for uploaded images.</li>
              <li className="mb-2"><strong>MongoDB:</strong> Stores image metadata and processed analysis results.</li>
            </ul>
            <p className="text-justify">These providers are selected carefully and are contractually obligated to process data only for authorised purposes and in compliance with data protection standards.</p>
          </div>

          <div className='bg-white/10 p-6 rounded-xl mb-5 shadow-md backdrop-blur-md transition-transform hover:scale-[1.02]'>
            <p className="text-justify">
              This policy ensures compliance with UK GDPR and other data protection regulations, safeguarding user rights and business obligations effectively.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;