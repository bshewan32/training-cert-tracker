import {
  useState,
  useEffect
} from 'react';
//import './App.css';


const CertificatesWithDashboard = ({
  token,
  employees = [],
  positions = [],
  certificateTypes = [],
  certificates = [],
  isAdmin = false,
  onViewEmployee,
  onViewAdmin,
  onCertificateAdded,
  onCertificateDeleted
}) => {
  const [dashboardStats, setDashboardStats] = useState({
    totalCertificates: 0,
    activeCertificates: 0,
    expiringSoon: 0,
    expired: 0,
    totalEmployees: 0,
    complianceRate: 0
  });
  const [complianceByPosition, setComplianceByPosition] = useState([]);
  const [urgentActions, setUrgentActions] = useState([]);

  useEffect(() => {
    calculateDashboardStats();
  }, [certificates, employees, positions]);

  const calculateDashboardStats = () => {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const totalCertificates = certificates.length;
    const activeCertificates = certificates.filter(cert => cert.status === 'ACTIVE').length;
    const expiringSoon = certificates.filter(cert => {
      const expiryDate = new Date(cert.expirationDate);
      return cert.status === 'ACTIVE' && expiryDate > today && expiryDate <= thirtyDaysFromNow;
    }).length;
    const expired = certificates.filter(cert => cert.status === 'EXPIRED').length;

    const activeEmployees = employees.filter(emp => emp.active !== false);
    const totalEmployees = activeEmployees.length;

    let requiredCertCount = 0;
    let activeRequiredCertCount = 0;

    activeEmployees.forEach(emp => {
      emp.positions.forEach(posId => {
        const position = positions.find(p => p._id === (typeof posId === 'object' ? posId._id : posId));
        if (position && position.requiredCertTypes) {
          position.requiredCertTypes.forEach(reqCert => {
            requiredCertCount++;
            const hasActive = certificates.some(cert =>
              cert.staffMember === emp.name &&
              cert.certType === reqCert &&
              cert.status === 'ACTIVE'
            );
            if (hasActive) activeRequiredCertCount++;
          });
        }
      });
    });

    const complianceRate = requiredCertCount > 0
      ? Math.round((activeRequiredCertCount / requiredCertCount) * 100)
      : 0;

    setDashboardStats({
      totalCertificates,
      activeCertificates,
      expiringSoon,
      expired,
      totalEmployees,
      complianceRate
    });

    const positionStats = [];
    positions.forEach(position => {
      const positionCerts = certificates.filter(cert => cert.position === position._id);
      const activeCerts = positionCerts.filter(cert => cert.status === 'ACTIVE');
      const employeesInPosition = activeEmployees.filter(emp =>
        emp.positions && emp.positions.some(pos =>
          (typeof pos === 'object' ? pos._id : pos) === position._id
        )
      );
      if (employeesInPosition.length > 0) {
        positionStats.push({
          position: position.title,
          department: position.department || 'No Department',
          employees: employeesInPosition.length,
          totalCerts: positionCerts.length,
          activeCerts: activeCerts.length,
          complianceRate: positionCerts.length > 0
            ? Math.round((activeCerts.length / positionCerts.length) * 100)
            : 0
        });
      }
    });
    positionStats.sort((a, b) => a.complianceRate - b.complianceRate);
    setComplianceByPosition(positionStats.slice(0, 5));

    const urgent = certificates
      .filter(cert => {
        const expiryDate = new Date(cert.expirationDate);
        return cert.status === 'ACTIVE' && expiryDate > today && expiryDate <= thirtyDaysFromNow;
      })
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
      .slice(0, 5)
      .map(cert => ({
        employee: cert.staffMember,
        certificate: cert.certificateType || cert.certificateName || cert.CertType,
        expiryDate: cert.expirationDate,
        daysLeft: Math.ceil((new Date(cert.expirationDate) - today) / (1000 * 60 * 60 * 24))
      }));

    setUrgentActions(urgent);
  };
};

export default CertificatesWithDashboard;
